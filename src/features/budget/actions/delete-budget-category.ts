'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import { deleteBudgetCategorySchema } from '../validators/budget-schemas';

type Input = { id: string };

export async function deleteBudgetCategory(input: Input): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = deleteBudgetCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const cat = await tx.budgetCategory.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, isSystem: true },
      });
      if (!cat) {
        throw new Error('not_found');
      }
      if (cat.isSystem) {
        throw new Error('conflict:system_category_locked');
      }

      const inUse = await tx.budgetLine.count({
        where: { categoryId: cat.id, deletedAt: null },
      });
      if (inUse > 0) {
        throw new Error('conflict:category_in_use');
      }

      await tx.budgetCategory.update({
        where: { id: cat.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_category',
        entityId: cat.id,
        action: 'deleted',
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
    console.error('deleteBudgetCategory failed', error);
    return { ok: false, error: 'server' };
  }
}
