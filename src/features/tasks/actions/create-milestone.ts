'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type CreateMilestoneInput, createMilestoneSchema } from '../validators/task-schemas';

export async function createMilestone(
  input: CreateMilestoneInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: data.flipId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }

      // Default sort order to the end of the list when not supplied (0).
      const sortOrder =
        data.sortOrder > 0
          ? data.sortOrder
          : ((
              await tx.milestone.aggregate({
                where: { flipId: flip.id, deletedAt: null },
                _max: { sortOrder: true },
              })
            )._max.sortOrder ?? 0) + 1;

      const milestone = await tx.milestone.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          title: data.title,
          description: data.description ?? null,
          targetDate: data.targetDate,
          isCritical: data.isCritical,
          sortOrder,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'milestone',
        entityId: milestone.id,
        action: 'created',
        changes: { flipId: flip.id, title: data.title },
      });

      return milestone;
    });

    revalidatePath(`/flips/${data.flipId}/timeline`);
    revalidatePath(`/flips/${data.flipId}`);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('createMilestone failed', error);
    return { ok: false, error: 'server' };
  }
}
