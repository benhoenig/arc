'use server';

import type { z } from 'zod';
import { auth } from '@/server/auth/neon-auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { signupSchema } from '../validators/auth-schemas';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Resolve the auth user id we should provision an org for.
 *
 * Returns one of:
 *  - `{ kind: 'ready', userId }` — proceed to provisioning. Either a brand-new
 *    sign-up, or an *orphaned* identity (auth row exists but never got a
 *    `public.users` + org) whose ownership we just re-verified by password.
 *  - `{ kind: 'conflict' }` — the email is already a fully-provisioned account.
 *  - `{ kind: 'error' }` — the upstream auth call failed.
 *
 * The orphan-resume path is what makes signup recoverable: previously, if the
 * post-`signUp` provisioning failed for any reason, the auth identity was left
 * behind and every retry bounced with "email taken" forever.
 */
async function resolveSignupUserId(
  email: string,
  password: string,
  fullName: string,
): Promise<{ kind: 'ready'; userId: string } | { kind: 'conflict' } | { kind: 'error' }> {
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM neon_auth."user" WHERE lower(email) = ${email} LIMIT 1
  `;
  const existingUserId = existing[0]?.id;

  if (existingUserId) {
    // An auth identity already exists. If it already has an org membership it's
    // a genuine duplicate. Otherwise it's a half-finished signup we can resume —
    // but only after proving the caller owns it (password must match).
    const membership = await db.userRole.findFirst({
      where: { userId: existingUserId, deletedAt: null },
      select: { id: true },
    });
    if (membership) {
      return { kind: 'conflict' };
    }

    const { error: signInError } = await auth.signIn.email({ email, password });
    if (signInError) {
      // Identity exists but the password doesn't match — treat as taken rather
      // than leaking that the account is unprovisioned.
      return { kind: 'conflict' };
    }
    return { kind: 'ready', userId: existingUserId };
  }

  const { data, error: authError } = await auth.signUp.email({ email, password, name: fullName });
  if (authError) {
    return { kind: 'error' };
  }

  // Use the id returned by signUp directly. Reading it back via getSession() in
  // the same request is racy (the session cookie isn't on the request yet) and
  // is exactly what orphaned the earlier signups.
  const userId = data?.user?.id;
  if (!userId) {
    return { kind: 'error' };
  }
  return { kind: 'ready', userId };
}

export async function signup(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ orgId: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const email = parsed.data.email.toLowerCase();

  const resolved = await resolveSignupUserId(email, parsed.data.password, parsed.data.fullName);
  if (resolved.kind === 'conflict') {
    return { ok: false, error: 'conflict', message: 'emailTaken' };
  }
  if (resolved.kind === 'error') {
    return { ok: false, error: 'server' };
  }
  const userId = resolved.userId;

  try {
    const result = await db.$transaction(async (tx) => {
      // Mirror the auth identity into public.users (replaces the old
      // handle_new_auth_user trigger). Upsert so a pre-existing row (e.g. an
      // earlier lazy ensure) still gets the name backfilled.
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

      const org = await tx.organization.create({
        data: {
          name: parsed.data.orgName,
          slug: `${slugify(parsed.data.orgName)}-${Date.now().toString(36)}`,
        },
      });

      // Seed the org's reference data via the DB functions: 5 system roles,
      // 9 flip stages, and the default budget categories. All three are
      // required before the org can create flips or budgets — seeding only
      // roles here previously left new orgs without stages, surfacing as
      // `stage_missing` on the first deal→flip conversion.
      await tx.$executeRawUnsafe('SELECT seed_organization_roles($1::uuid)', org.id);
      await tx.$executeRawUnsafe('SELECT seed_organization_flip_stages($1::uuid)', org.id);
      await tx.$executeRawUnsafe('SELECT seed_organization_budget_categories($1::uuid)', org.id);

      // Find the admin role we just seeded
      const adminRole = await tx.role.findFirst({
        where: { organizationId: org.id, slug: 'admin' },
        select: { id: true },
      });

      if (!adminRole) {
        throw new Error('Admin role not found after seeding');
      }

      await tx.userRole.create({
        data: {
          organizationId: org.id,
          userId,
          roleId: adminRole.id,
          createdBy: userId,
        },
      });

      await logActivity(tx, {
        orgId: org.id,
        userId,
        entityType: 'organization',
        entityId: org.id,
        action: 'created',
      });

      return org;
    });

    return { ok: true, data: { orgId: result.id } };
  } catch (error) {
    console.error('signup transaction failed', error);
    return { ok: false, error: 'server' };
  }
}
