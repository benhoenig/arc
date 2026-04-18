'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { generateInviteToken } from '../lib/invite-token';
import { createInvitationSchema } from '../validators/invitation-schemas';

const INVITATION_TTL_DAYS = 7;

export async function createInvitation(
  input: z.infer<typeof createInvitationSchema>,
): Promise<ActionResult<{ invitationId: string; rawToken: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { email, roleSlug } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { organizationId: orgId, slug: roleSlug, deletedAt: null },
        select: { id: true },
      });
      if (!role) {
        throw new Error('conflict:role_missing');
      }

      const existingMember = await tx.userRole.findFirst({
        where: {
          organizationId: orgId,
          deletedAt: null,
          user: { email },
        },
        select: { id: true },
      });
      if (existingMember) {
        throw new Error('conflict:already_member');
      }

      const existingPending = await tx.orgInvitation.findFirst({
        where: {
          organizationId: orgId,
          email,
          acceptedAt: null,
          revokedAt: null,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingPending) {
        throw new Error('conflict:duplicate');
      }

      const { rawToken, tokenHash } = generateInviteToken();
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

      const invitation = await tx.orgInvitation.create({
        data: {
          organizationId: orgId,
          email,
          roleId: role.id,
          tokenHash,
          expiresAt,
          invitedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_invitation',
        entityId: invitation.id,
        action: 'created',
        context: { email, roleSlug },
      });

      return { id: invitation.id, rawToken };
    });

    revalidatePath('/settings/members');
    return {
      ok: true,
      data: { invitationId: result.id, rawToken: result.rawToken },
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('conflict:')) {
      return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
    }
    console.error('createInvitation failed', error);
    return { ok: false, error: 'server' };
  }
}
