'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { updateFlipSchema } from '../validators/flip-schemas';

function parseTimestamp(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return new Date(value);
}

export async function updateFlip(
  input: z.infer<typeof updateFlipSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateFlipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.flip.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!existing) {
        throw new Error('not_found');
      }
      if (existing.killedAt) {
        throw new Error('conflict:killed');
      }

      const acquiredAt = parseTimestamp(parsed.data.acquiredAt ?? undefined);
      const listedAt = parseTimestamp(parsed.data.listedAt ?? undefined);
      const soldAt = parseTimestamp(parsed.data.soldAt ?? undefined);

      await tx.flip.update({
        where: { id: parsed.data.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.hasInvestorCapital !== undefined
            ? { hasInvestorCapital: parsed.data.hasInvestorCapital }
            : {}),
          ...(parsed.data.isOnHold !== undefined ? { isOnHold: parsed.data.isOnHold } : {}),
          ...(parsed.data.onHoldReason !== undefined
            ? { onHoldReason: parsed.data.onHoldReason }
            : {}),
          ...(parsed.data.actualPurchasePriceThb !== undefined
            ? { actualPurchasePriceThb: parsed.data.actualPurchasePriceThb }
            : {}),
          ...(acquiredAt !== undefined ? { acquiredAt } : {}),
          ...(listedAt !== undefined ? { listedAt } : {}),
          ...(soldAt !== undefined ? { soldAt } : {}),
          ...(parsed.data.actualSalePriceThb !== undefined
            ? { actualSalePriceThb: parsed.data.actualSalePriceThb }
            : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: parsed.data.id,
        action: 'updated',
      });
    });

    revalidatePath('/flips');
    revalidatePath(`/flips/${parsed.data.id}`);
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
    console.error('updateFlip failed', error);
    return { ok: false, error: 'server' };
  }
}
