'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type AssignTaskInput, assignTaskSchema } from '../validators/task-schemas';

export async function assignTask(input: AssignTaskInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = assignTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, assignedToUserId } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true },
      });
      if (!task) {
        throw new Error('not_found');
      }

      if (assignedToUserId) {
        const member = await tx.userRole.findFirst({
          where: { userId: assignedToUserId, organizationId: orgId },
          select: { userId: true },
        });
        if (!member) {
          throw new Error('not_found');
        }
      }

      await tx.task.update({
        where: { id: task.id },
        data: { assignedToUserId, updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'task',
        entityId: task.id,
        action: 'assigned',
        changes: { assignedToUserId },
      });

      return task;
    });

    revalidatePath(`/flips/${result.flipId}/tasks`);
    revalidatePath(`/flips/${result.flipId}`);
    revalidatePath('/my-tasks');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('assignTask failed', error);
    return { ok: false, error: 'server' };
  }
}
