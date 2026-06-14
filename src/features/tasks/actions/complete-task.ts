'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { taskIdSchema } from '../validators/task-schemas';

// completeTask is the only path to status='done'. It stamps completed_at +
// completed_by so the completion audit can't be set by a plain status edit.
export async function completeTask(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true, status: true },
      });
      if (!task) {
        throw new Error('not_found');
      }
      if (task.status === 'done') {
        throw new Error('conflict:already_done');
      }

      await tx.task.update({
        where: { id: task.id },
        data: {
          status: 'done',
          completedAt: new Date(),
          completedBy: user.id,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'task',
        entityId: task.id,
        action: 'completed',
      });

      return task;
    });

    revalidatePath(`/flips/${result.flipId}/tasks`);
    revalidatePath(`/flips/${result.flipId}`);
    revalidatePath('/my-tasks');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('completeTask failed', error);
    return { ok: false, error: 'server' };
  }
}
