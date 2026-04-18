'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { moveFlipToStageSchema } from '../validators/flip-schemas';

export async function moveFlipToStage(
  input: z.infer<typeof moveFlipToStageSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = moveFlipToStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          stageId: true,
          soldAt: true,
          killedAt: true,
          stage: { select: { slug: true } },
        },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt || flip.stage.slug === 'killed') {
        throw new Error('conflict:terminal_killed');
      }
      if (flip.stage.slug === 'sold') {
        throw new Error('conflict:terminal_sold');
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
      // Killing is only reachable via killFlip; stage moves can't land here.
      if (targetStage.slug === 'killed') {
        throw new Error('conflict:use_kill_action');
      }

      const isSameStage = targetStage.id === flip.stageId;
      if (isSameStage) {
        return;
      }

      // Moving into `sold` also stamps sold_at for downstream dashboards.
      const extra = targetStage.slug === 'sold' ? { soldAt: new Date() } : {};

      await tx.flip.update({
        where: { id: flip.id },
        data: {
          stageId: targetStage.id,
          ...extra,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: 'stage_changed',
        changes: { from: flip.stageId, to: targetStage.id },
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
    console.error('moveFlipToStage failed', error);
    return { ok: false, error: 'server' };
  }
}
