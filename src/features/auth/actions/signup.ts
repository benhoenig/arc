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

export async function signup(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ orgId: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const email = parsed.data.email.toLowerCase();

  // Pre-check against the managed identity table for a deterministic
  // "email taken" signal rather than parsing Better Auth's error text.
  const existing = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM neon_auth."user" WHERE lower(email) = ${email}) AS "exists"
  `;
  if (existing[0]?.exists) {
    return { ok: false, error: 'conflict', message: 'emailTaken' };
  }

  const { error: authError } = await auth.signUp.email({
    email,
    password: parsed.data.password,
    name: parsed.data.fullName,
  });

  if (authError) {
    return { ok: false, error: 'server' };
  }

  // signUp.email auto-establishes the session; read it to get the new uuid.
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: 'server' };
  }

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

      // Seed the 5 system roles via the DB function
      await tx.$executeRawUnsafe('SELECT seed_organization_roles($1::uuid)', org.id);

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
