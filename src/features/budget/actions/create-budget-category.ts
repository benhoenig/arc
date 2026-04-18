'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import {
  type CreateBudgetCategoryInput,
  createBudgetCategorySchema,
} from '../validators/budget-schemas';

export async function createBudgetCategory(
  input: CreateBudgetCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = createBudgetCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const clash = await tx.budgetCategory.findFirst({
        where: { organizationId: orgId, slug: parsed.data.slug, deletedAt: null },
        select: { id: true },
      });
      if (clash) {
        throw new Error('conflict:slug_exists');
      }

      const row = await tx.budgetCategory.create({
        data: {
          organizationId: orgId,
          slug: parsed.data.slug,
          nameTh: parsed.data.nameTh,
          nameEn: parsed.data.nameEn ?? null,
          sortOrder: parsed.data.sortOrder,
          isSystem: false,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_category',
        entityId: row.id,
        action: 'created',
        changes: { slug: parsed.data.slug, nameTh: parsed.data.nameTh },
      });

      return row;
    });

    revalidatePath('/settings/budget-categories');
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('conflict:')) {
      return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
    }
    console.error('createBudgetCategory failed', error);
    return { ok: false, error: 'server' };
  }
}
