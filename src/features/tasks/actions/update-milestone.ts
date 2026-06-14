'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type UpdateMilestoneInput, updateMilestoneSchema } from '../validators/task-schemas';

export async function updateMilestone(
  input: UpdateMilestoneInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...fields } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true },
      });
      if (!milestone) {
        throw new Error('not_found');
      }

      const data: Prisma.MilestoneUpdateInput = { updatedByUser: { connect: { id: user.id } } };
      if (fields.title !== undefined) {
        data.title = fields.title;
      }
      if (fields.description !== undefined) {
        data.description = fields.description;
      }
      if (fields.targetDate !== undefined) {
        data.targetDate = fields.targetDate;
      }
      if (fields.isCritical !== undefined) {
        data.isCritical = fields.isCritical;
      }
      if (fields.sortOrder !== undefined) {
        data.sortOrder = fields.sortOrder;
      }

      await tx.milestone.update({ where: { id: milestone.id }, data });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'milestone',
        entityId: milestone.id,
        action: 'updated',
        changes: fields as Prisma.InputJsonValue,
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
    console.error('updateMilestone failed', error);
    return { ok: false, error: 'server' };
  }
}
