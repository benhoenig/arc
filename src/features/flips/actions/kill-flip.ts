'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { killFlipSchema } from '../validators/flip-schemas';

export async function killFlip(input: z.infer<typeof killFlipSchema>): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = killFlipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt) {
        throw new Error('conflict:already_killed');
      }
      if (flip.soldAt) {
        throw new Error('conflict:already_sold');
      }

      const killedStage = await tx.flipStage.findFirst({
        where: { organizationId: orgId, slug: 'killed', deletedAt: null },
        select: { id: true },
      });
      if (!killedStage) {
        throw new Error('conflict:stage_missing');
      }

      await tx.flip.update({
        where: { id: flip.id },
        data: {
          stageId: killedStage.id,
          killedAt: new Date(),
          killedReason: parsed.data.reason,
          notes: parsed.data.notes ?? undefined,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: 'killed',
        changes: { reason: parsed.data.reason },
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
    console.error('killFlip failed', error);
    return { ok: false, error: 'server' };
  }
}
