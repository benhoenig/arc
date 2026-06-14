'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { taskIdSchema } from '../validators/task-schemas';

// Undo a completion: status back to 'open', clear the completion stamp.
export async function reopenTask(input: { id: string }): Promise<ActionResult<{ id: string }>> {
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
        select: { id: true, flipId: true },
      });
      if (!task) {
        throw new Error('not_found');
      }

      await tx.task.update({
        where: { id: task.id },
        data: { status: 'open', completedAt: null, completedBy: null, updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'task',
        entityId: task.id,
        action: 'reopened',
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
    console.error('reopenTask failed', error);
    return { ok: false, error: 'server' };
  }
}
