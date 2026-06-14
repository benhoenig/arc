'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { milestoneIdSchema } from '../validators/task-schemas';

export async function deleteMilestone(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = milestoneIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true },
      });
      if (!milestone) {
        throw new Error('not_found');
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'milestone',
        entityId: milestone.id,
        action: 'deleted',
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
    console.error('deleteMilestone failed', error);
    return { ok: false, error: 'server' };
  }
}
