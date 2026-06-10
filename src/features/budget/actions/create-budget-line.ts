'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type CreateBudgetLineInput, createBudgetLineSchema } from '../validators/budget-schemas';

export async function createBudgetLine(
  input: CreateBudgetLineInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createBudgetLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: parsed.data.flipId, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt || flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const category = await tx.budgetCategory.findFirst({
        where: { id: parsed.data.categoryId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!category) {
        throw new Error('not_found');
      }

      const line = await tx.budgetLine.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          categoryId: category.id,
          description: parsed.data.description,
          budgetedAmountThb: parsed.data.budgetedAmountThb,
          committedAmountThb: parsed.data.committedAmountThb,
          notes: parsed.data.notes ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_line',
        entityId: line.id,
        action: 'created',
        changes: {
          flipId: flip.id,
          categoryId: category.id,
          description: parsed.data.description,
          budgetedAmountThb: parsed.data.budgetedAmountThb,
        },
      });

      return line;
    });

    revalidatePath(`/flips/${parsed.data.flipId}/budget`);
    revalidatePath(`/flips/${parsed.data.flipId}`);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('createBudgetLine failed', error);
    return { ok: false, error: 'server' };
  }
}
