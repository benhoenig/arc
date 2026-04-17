'use server';

import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getSupabaseServerClient } from '@/server/supabase/server-client';
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

  const supabase = await getSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      return { ok: false, error: 'conflict', message: 'emailTaken' };
    }
    return { ok: false, error: 'server' };
  }

  const userId = authData.user.id;

  try {
    const result = await db.$transaction(async (tx) => {
      // Update the public.users row created by the auth trigger
      await tx.user.update({
        where: { id: userId },
        data: {
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
      await tx.$queryRawUnsafe('SELECT seed_organization_roles($1::uuid)', org.id);

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
