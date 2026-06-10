'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type UpdateBudgetLineInput, updateBudgetLineSchema } from '../validators/budget-schemas';

export async function updateBudgetLine(input: UpdateBudgetLineInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateBudgetLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { id, categoryId, description, budgetedAmountThb, committedAmountThb, notes } = parsed.data;

  // Require at least one field to change beyond the id itself.
  const hasChange =
    categoryId !== undefined ||
    description !== undefined ||
    budgetedAmountThb !== undefined ||
    committedAmountThb !== undefined ||
    notes !== undefined;
  if (!hasChange) {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const line = await tx.budgetLine.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true, flip: { select: { soldAt: true, killedAt: true } } },
      });
      if (!line) {
        throw new Error('not_found');
      }
      if (line.flip.killedAt || line.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      if (categoryId) {
        const cat = await tx.budgetCategory.findFirst({
          where: { id: categoryId, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        if (!cat) {
          throw new Error('not_found');
        }
      }

      await tx.budgetLine.update({
        where: { id: line.id },
        data: {
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(budgetedAmountThb !== undefined ? { budgetedAmountThb } : {}),
          ...(committedAmountThb !== undefined ? { committedAmountThb } : {}),
          ...(notes !== undefined ? { notes } : {}),
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_line',
        entityId: line.id,
        action: 'updated',
        changes: {
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(budgetedAmountThb !== undefined ? { budgetedAmountThb } : {}),
          ...(committedAmountThb !== undefined ? { committedAmountThb } : {}),
        },
      });

      return line.flipId;
    });

    revalidatePath(`/flips/${flipId}/budget`);
    revalidatePath(`/flips/${flipId}`);
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
    console.error('updateBudgetLine failed', error);
    return { ok: false, error: 'server' };
  }
}
