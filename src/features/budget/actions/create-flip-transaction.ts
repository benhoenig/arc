'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type CreateFlipTransactionInput,
  createFlipTransactionSchema,
  toSignedAmount,
} from '../validators/transaction-schemas';

export async function createFlipTransaction(
  input: CreateFlipTransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createFlipTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: data.flipId, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt || flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      let budgetLineId: string | null = null;
      if (data.kind === 'spend' || data.kind === 'refund') {
        const line = await tx.budgetLine.findFirst({
          where: {
            id: data.budgetLineId,
            organizationId: orgId,
            flipId: flip.id,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!line) {
          throw new Error('not_found');
        }
        budgetLineId = line.id;
      }

      const signed = toSignedAmount(data.kind, data.amountThb);

      const tx_row = await tx.flipTransaction.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          budgetLineId,
          date: data.date,
          amountThb: signed,
          description: data.description,
          sourceNote: data.sourceNote ?? null,
          kind: data.kind,
          receiptPath: data.receiptPath ?? null,
          notes: data.notes ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip_transaction',
        entityId: tx_row.id,
        action: 'created',
        changes: {
          flipId: flip.id,
          kind: data.kind,
          amountThb: signed,
          budgetLineId,
        },
      });

      return tx_row;
    });

    revalidatePath(`/flips/${data.flipId}/budget`);
    revalidatePath(`/flips/${data.flipId}`);
    return { ok: true, data: { id: result.id } };
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
    console.error('createFlipTransaction failed', error);
    return { ok: false, error: 'server' };
  }
}
