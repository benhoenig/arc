'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  kindNeedsBudgetLine,
  type TransactionKind,
  toSignedAmount,
  type UpdateFlipTransactionInput,
  updateFlipTransactionSchema,
} from '../validators/transaction-schemas';

export async function updateFlipTransaction(
  input: UpdateFlipTransactionInput,
): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateFlipTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, budgetLineId, amountThb, date, description, sourceNote, receiptPath, notes } =
    parsed.data;

  const hasChange =
    budgetLineId !== undefined ||
    amountThb !== undefined ||
    date !== undefined ||
    description !== undefined ||
    sourceNote !== undefined ||
    receiptPath !== undefined ||
    notes !== undefined;
  if (!hasChange) {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const row = await tx.flipTransaction.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          kind: true,
          budgetLineId: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!row) {
        throw new Error('not_found');
      }
      if (row.flip.killedAt || row.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const kind = row.kind as TransactionKind;

      // Budget-line change is only valid for kinds that can carry a line.
      // For non-carrying kinds the DB CHECK would already reject — guard here
      // for a friendlier error.
      if (budgetLineId !== undefined && budgetLineId !== null) {
        if (!kindNeedsBudgetLine(kind)) {
          throw new Error('conflict:budget_line_not_allowed');
        }
        const line = await tx.budgetLine.findFirst({
          where: {
            id: budgetLineId,
            organizationId: orgId,
            flipId: row.flipId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!line) {
          throw new Error('not_found');
        }
      }

      const dataToUpdate: Prisma.FlipTransactionUncheckedUpdateInput = {
        updatedBy: user.id,
      };
      const changeLog: Record<string, string | number | null> = {};
      if (budgetLineId !== undefined) {
        dataToUpdate.budgetLineId = budgetLineId;
        changeLog.budgetLineId = budgetLineId;
      }
      if (amountThb !== undefined) {
        const signed = toSignedAmount(kind, amountThb);
        dataToUpdate.amountThb = signed;
        changeLog.amountThb = signed;
      }
      if (date !== undefined) {
        dataToUpdate.date = date;
        changeLog.date = date.toISOString();
      }
      if (description !== undefined) {
        dataToUpdate.description = description;
        changeLog.description = description;
      }
      if (sourceNote !== undefined) {
        dataToUpdate.sourceNote = sourceNote;
        changeLog.sourceNote = sourceNote;
      }
      if (receiptPath !== undefined) {
        dataToUpdate.receiptPath = receiptPath;
        changeLog.receiptPath = receiptPath;
      }
      if (notes !== undefined) {
        dataToUpdate.notes = notes;
        changeLog.notes = notes;
      }

      await tx.flipTransaction.update({
        where: { id: row.id },
        data: dataToUpdate,
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip_transaction',
        entityId: row.id,
        action: 'updated',
        changes: changeLog,
      });

      return row.flipId;
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
        return {
          ok: false,
          error: 'conflict',
          message: error.message.slice('conflict:'.length),
        };
      }
    }
    console.error('updateFlipTransaction failed', error);
    return { ok: false, error: 'server' };
  }
}
