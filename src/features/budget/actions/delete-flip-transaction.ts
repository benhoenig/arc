'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { deleteFlipTransactionSchema } from '../validators/transaction-schemas';

type Input = { id: string };

export async function deleteFlipTransaction(input: Input): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = deleteFlipTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const row = await tx.flipTransaction.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!row) {
        throw new Error('not_found');
      }
      if (row.flip.killedAt || row.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      await tx.flipTransaction.update({
        where: { id: row.id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip_transaction',
        entityId: row.id,
        action: 'deleted',
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
    console.error('deleteFlipTransaction failed', error);
    return { ok: false, error: 'server' };
  }
}
