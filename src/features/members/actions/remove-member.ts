'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { removeMemberSchema } from '../validators/invitation-schemas';

/**
 * Removes a member from the org. Safety rules (per Ben, 2026-04-18):
 *  - Admin-only action.
 *  - Can't remove yourself (use a future "leave organization" flow).
 *  - Can't remove the last admin — would lock the org out.
 *
 * Soft-deletes the user_roles row. Existing flip_team_members assignments
 * for that user remain; they simply stop appearing in pickers.
 */
export async function removeMember(
  input: z.infer<typeof removeMemberSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const target = await tx.userRole.findFirst({
        where: {
          id: parsed.data.userRoleId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          role: { select: { slug: true } },
        },
      });
      if (!target) {
        throw new Error('not_found');
      }
      if (target.userId === user.id) {
        throw new Error('conflict:cannot_remove_self');
      }
      if (target.role.slug === 'admin') {
        const adminCount = await tx.userRole.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            role: { slug: 'admin' },
          },
        });
        if (adminCount <= 1) {
          throw new Error('conflict:last_admin');
        }
      }

      await tx.userRole.update({
        where: { id: target.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'user_role',
        entityId: target.id,
        action: 'removed',
        changes: { userId: target.userId, roleSlug: target.role.slug },
      });
    });

    revalidatePath('/settings/members');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('removeMember failed', error);
    return { ok: false, error: 'server' };
  }
}
