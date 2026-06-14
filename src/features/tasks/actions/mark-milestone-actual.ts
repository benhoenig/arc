'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type MarkMilestoneActualInput,
  markMilestoneActualSchema,
} from '../validators/task-schemas';

// Set (or clear) a milestone's actual date — marks it hit on the timeline.
// Passing null reopens it.
export async function markMilestoneActual(
  input: MarkMilestoneActualInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = markMilestoneActualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, actualDate } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true },
      });
      if (!milestone) {
        throw new Error('not_found');
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { actualDate, updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'milestone',
        entityId: milestone.id,
        action: actualDate ? 'marked_actual' : 'reopened',
        changes: { actualDate },
      });

      return milestone;
    });

    revalidatePath(`/flips/${result.flipId}/timeline`);
    revalidatePath(`/flips/${result.flipId}`);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('markMilestoneActual failed', error);
    return { ok: false, error: 'server' };
  }
}
