'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type UpdateTaskInput, updateTaskSchema } from '../validators/task-schemas';

export async function updateTask(input: UpdateTaskInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...fields } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true },
      });
      if (!task) {
        throw new Error('not_found');
      }

      if (fields.assignedToUserId) {
        const member = await tx.userRole.findFirst({
          where: { userId: fields.assignedToUserId, organizationId: orgId },
          select: { userId: true },
        });
        if (!member) {
          throw new Error('not_found');
        }
      }
      if (fields.relatedAssignmentId) {
        const assignment = await tx.contractorAssignment.findFirst({
          where: { id: fields.relatedAssignmentId, organizationId: orgId, flipId: task.flipId },
          select: { id: true },
        });
        if (!assignment) {
          throw new Error('not_found');
        }
      }
      if (fields.flipStageId) {
        const stage = await tx.flipStage.findFirst({
          where: { id: fields.flipStageId, organizationId: orgId },
          select: { id: true },
        });
        if (!stage) {
          throw new Error('not_found');
        }
      }

      const data: Prisma.TaskUpdateInput = { updatedByUser: { connect: { id: user.id } } };
      if (fields.title !== undefined) {
        data.title = fields.title;
      }
      if (fields.description !== undefined) {
        data.description = fields.description;
      }
      if (fields.priority !== undefined) {
        data.priority = fields.priority;
      }
      if (fields.status !== undefined) {
        data.status = fields.status;
      }
      if (fields.dueDate !== undefined) {
        data.dueDate = fields.dueDate;
      }
      if (fields.assignedToUserId !== undefined) {
        data.assignedToUser = fields.assignedToUserId
          ? { connect: { id: fields.assignedToUserId } }
          : { disconnect: true };
      }
      if (fields.relatedAssignmentId !== undefined) {
        data.relatedAssignment = fields.relatedAssignmentId
          ? { connect: { id: fields.relatedAssignmentId } }
          : { disconnect: true };
      }
      if (fields.flipStageId !== undefined) {
        data.flipStage = fields.flipStageId
          ? { connect: { id: fields.flipStageId } }
          : { disconnect: true };
      }

      await tx.task.update({ where: { id: task.id }, data });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'task',
        entityId: task.id,
        action: 'updated',
        changes: fields as Prisma.InputJsonValue,
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
    console.error('updateTask failed', error);
    return { ok: false, error: 'server' };
  }
}
