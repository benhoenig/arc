'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { reviveFlipSchema } from '../validators/flip-schemas';

/**
 * Reverses a kill: clears killed_at / killed_reason and moves the flip back
 * to a chosen non-terminal stage. Mirrors the gate on killFlip (any org
 * member; confirm dialog is the UX guard). The target stage must not be
 * `sold` or `killed` — reviving straight into `sold` would bypass the
 * normal sale flow and leave `sold_at` inconsistent.
 */
export async function reviveFlip(
  input: z.infer<typeof reviveFlipSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = reviveFlipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          killedAt: true,
          soldAt: true,
          stage: { select: { slug: true } },
        },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (!flip.killedAt && flip.stage.slug !== 'killed') {
        throw new Error('conflict:not_killed');
      }

      const targetStage = await tx.flipStage.findFirst({
        where: {
          id: parsed.data.stageId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true, slug: true, stageType: true },
      });
      if (!targetStage) {
        throw new Error('not_found');
      }
      if (targetStage.slug === 'killed' || targetStage.slug === 'sold') {
        throw new Error('conflict:target_terminal');
      }

      await tx.flip.update({
        where: { id: flip.id },
        data: {
          stageId: targetStage.id,
          killedAt: null,
          killedReason: null,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: 'revived',
        changes: { toStageSlug: targetStage.slug },
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
    console.error('reviveFlip failed', error);
    return { ok: false, error: 'server' };
  }
}
