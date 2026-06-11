'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import {
  type UpdateBudgetCategoryInput,
  updateBudgetCategorySchema,
} from '../validators/budget-schemas';

export async function updateBudgetCategory(
  input: UpdateBudgetCategoryInput,
): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = updateBudgetCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { id, slug, nameTh, nameEn, sortOrder, pnlBucket } = parsed.data;
  const hasChange =
    slug !== undefined ||
    nameTh !== undefined ||
    nameEn !== undefined ||
    sortOrder !== undefined ||
    pnlBucket !== undefined;
  if (!hasChange) {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.budgetCategory.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, isSystem: true, slug: true },
      });
      if (!existing) {
        throw new Error('not_found');
      }

      // System categories may be renamed/reordered but not re-slugged — slug
      // is the stable identifier referenced by seed + potential future code.
      if (existing.isSystem && slug !== undefined && slug !== existing.slug) {
        throw new Error('conflict:system_slug_locked');
      }

      if (slug !== undefined && slug !== existing.slug) {
        const clash = await tx.budgetCategory.findFirst({
          where: { organizationId: orgId, slug, deletedAt: null, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          throw new Error('conflict:slug_exists');
        }
      }

      await tx.budgetCategory.update({
        where: { id: existing.id },
        data: {
          ...(slug !== undefined ? { slug } : {}),
          ...(nameTh !== undefined ? { nameTh } : {}),
          ...(nameEn !== undefined ? { nameEn } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
          ...(pnlBucket !== undefined ? { pnlBucket } : {}),
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_category',
        entityId: existing.id,
        action: 'updated',
        changes: { slug, nameTh, nameEn, sortOrder, pnlBucket },
      });
    });

    revalidatePath('/settings/budget-categories');
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
    console.error('updateBudgetCategory failed', error);
    return { ok: false, error: 'server' };
  }
}
