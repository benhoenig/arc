'use server';

import type { z } from 'zod';
import { auth } from '@/server/auth/neon-auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { hashInviteToken } from '../lib/invite-token';
import { acceptInvitationSchema } from '../validators/invitation-schemas';

type AcceptErrorCode =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'email_mismatch'
  | 'already_member'
  | 'email_taken';

/** Thrown inside the consume transaction to surface a precise conflict code. */
class AcceptError extends Error {
  constructor(public readonly code: AcceptErrorCode) {
    super(code);
  }
}

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  accepted_at: Date | null;
  revoked_at: Date | null;
  deleted_at: Date | null;
  expires_at: Date;
}

/**
 * Consumes an invitation as a brand-new user. Replaces the two dropped
 * SECURITY DEFINER functions (`get_invitation_by_hash` + `accept_invitation`):
 * since Prisma connects as the table owner on Neon, there's no RLS barrier to
 * bridge, so the whole flow is a plain locked transaction.
 *
 *  1. Pre-validate the invitation (cheap path for not_found/expired/etc.) so we
 *     don't create an auth identity for a dead invite.
 *  2. Neon Auth sign-up with the invitation email — auto-establishes a session.
 *  3. Locked transaction (`SELECT ... FOR UPDATE`): re-validate, mirror the user
 *     into public.users, create the user_roles row, mark accepted, log activity.
 *
 * Existing-user-joins-another-org is still unsupported (they hit `email_taken`
 * on sign-up) — relevant once multi-org session switching is built.
 */
export async function acceptInvitation(
  input: z.infer<typeof acceptInvitationSchema>,
): Promise<ActionResult<{ organizationId: string }>> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  // 1. Cheap pre-validation (non-locking) — short-circuit dead invites before
  //    creating an auth identity.
  const preRows = await db.$queryRaw<InvitationRow[]>`
    SELECT id, organization_id, email, role_id, accepted_at, revoked_at, deleted_at, expires_at
    FROM org_invitations WHERE token_hash = ${tokenHash}
  `;
  const pre = preRows[0];
  if (!pre || pre.deleted_at) {
    return { ok: false, error: 'not_found' };
  }
  if (pre.accepted_at) {
    return { ok: false, error: 'conflict', message: 'already_accepted' };
  }
  if (pre.revoked_at) {
    return { ok: false, error: 'conflict', message: 'revoked' };
  }
  if (pre.expires_at <= new Date()) {
    return { ok: false, error: 'conflict', message: 'expired' };
  }

  const email = pre.email.toLowerCase();

  // Existing identity → existing-user-join-second-org, which we don't support.
  const existingAuth = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM neon_auth."user" WHERE lower(email) = ${email}) AS "exists"
  `;
  if (existingAuth[0]?.exists) {
    return { ok: false, error: 'conflict', message: 'email_taken' satisfies AcceptErrorCode };
  }

  // 2. Create the identity (auto-signs in).
  const { data: signUpData, error: authError } = await auth.signUp.email({
    email,
    password: parsed.data.password,
    name: parsed.data.fullName,
  });
  if (authError) {
    return { ok: false, error: 'server' };
  }

  // Use the id returned by signUp directly — reading it back via getSession()
  // in the same request is racy (the session cookie isn't on the request yet).
  const userId = signUpData?.user?.id;
  if (!userId) {
    return { ok: false, error: 'server' };
  }

  // 3. Locked consume transaction.
  try {
    const organizationId = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<InvitationRow[]>`
        SELECT id, organization_id, email, role_id, accepted_at, revoked_at, deleted_at, expires_at
        FROM org_invitations WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
      const inv = rows[0];
      if (!inv || inv.deleted_at) {
        throw new AcceptError('not_found');
      }
      if (inv.accepted_at) {
        throw new AcceptError('already_accepted');
      }
      if (inv.revoked_at) {
        throw new AcceptError('revoked');
      }
      if (inv.expires_at <= new Date()) {
        throw new AcceptError('expired');
      }

      const alreadyMember = await tx.userRole.findFirst({
        where: { userId, organizationId: inv.organization_id, deletedAt: null },
        select: { id: true },
      });
      if (alreadyMember) {
        throw new AcceptError('already_member');
      }

      await tx.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          fullName: parsed.data.fullName,
          displayName: parsed.data.fullName,
        },
        update: {
          fullName: parsed.data.fullName,
          displayName: parsed.data.fullName,
        },
      });

      await tx.userRole.create({
        data: {
          organizationId: inv.organization_id,
          userId,
          roleId: inv.role_id,
          createdBy: userId,
        },
      });

      await tx.orgInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date(), acceptedBy: userId },
      });

      await logActivity(tx, {
        orgId: inv.organization_id,
        userId,
        entityType: 'org_invitation',
        entityId: inv.id,
        action: 'accepted',
        context: { role_id: inv.role_id },
      });

      return inv.organization_id;
    });

    return { ok: true, data: { organizationId } };
  } catch (error) {
    if (error instanceof AcceptError) {
      return { ok: false, error: 'conflict', message: error.code };
    }
    console.error('acceptInvitation failed', error);
    return { ok: false, error: 'server' };
  }
}
