'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type CreateTaskInput, createTaskSchema } from '../validators/task-schemas';

export async function createTask(input: CreateTaskInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createTaskSchema.safeParse(input);
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

      // Validate optional references stay within the same flip / org so a
      // task can't be cross-linked to another tenant's data.
      if (data.assignedToUserId) {
        const member = await tx.userRole.findFirst({
          where: { userId: data.assignedToUserId, organizationId: orgId },
          select: { userId: true },
        });
        if (!member) {
          throw new Error('not_found');
        }
      }
      if (data.relatedAssignmentId) {
        const assignment = await tx.contractorAssignment.findFirst({
          where: { id: data.relatedAssignmentId, organizationId: orgId, flipId: flip.id },
          select: { id: true },
        });
        if (!assignment) {
          throw new Error('not_found');
        }
      }
      if (data.flipStageId) {
        const stage = await tx.flipStage.findFirst({
          where: { id: data.flipStageId, organizationId: orgId },
          select: { id: true },
        });
        if (!stage) {
          throw new Error('not_found');
        }
      }

      const task = await tx.task.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          title: data.title,
          description: data.description ?? null,
          assignedToUserId: data.assignedToUserId ?? null,
          relatedAssignmentId: data.relatedAssignmentId ?? null,
          flipStageId: data.flipStageId ?? null,
          priority: data.priority,
          dueDate: data.dueDate ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'task',
        entityId: task.id,
        action: 'created',
        changes: { flipId: flip.id, title: data.title, priority: data.priority },
      });

      return task;
    });

    revalidatePath(`/flips/${data.flipId}/tasks`);
    revalidatePath(`/flips/${data.flipId}`);
    revalidatePath('/my-tasks');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('createTask failed', error);
    return { ok: false, error: 'server' };
  }
}
