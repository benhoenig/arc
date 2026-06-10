'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type AssignmentStatus,
  canTransitionAssignmentStatus,
  setAssignmentStatusSchema,
} from '../validators/contractor-schemas';

// One action for all status transitions (activate / complete / cancel /
// dispute). UI calls this with the target status; transition rules live in
// the validator module. On transition to `completed`, set `actual_end_date`
// if not already set.
export async function setAssignmentStatus(input: {
  id: string;
  status: AssignmentStatus;
}): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = setAssignmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, status: nextStatus } = parsed.data;

  try {
    const flipId = await db.$transaction(async (tx) => {
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          contractorId: true,
          status: true,
          actualEndDate: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const currentStatus = assignment.status as AssignmentStatus;
      if (currentStatus === nextStatus) {
        return { flipId: assignment.flipId, contractorId: assignment.contractorId };
      }
      if (!canTransitionAssignmentStatus(currentStatus, nextStatus)) {
        throw new Error('conflict:invalid_status_transition');
      }

      await tx.contractorAssignment.update({
        where: { id: assignment.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'completed' && assignment.actualEndDate == null
            ? { actualEndDate: new Date() }
            : {}),
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_assignment',
        entityId: assignment.id,
        action: 'status_changed',
        changes: { from: currentStatus, to: nextStatus },
      });

      return { flipId: assignment.flipId, contractorId: assignment.contractorId };
    });

    revalidatePath(`/flips/${flipId.flipId}/contractors`);
    revalidatePath(`/flips/${flipId.flipId}`);
    revalidatePath(`/contractors/${flipId.contractorId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return {
          ok: false,
          error: 'conflict',
          message: error.message.slice('conflict:'.length),
        };
      }
    }
    console.error('setAssignmentStatus failed', error);
    return { ok: false, error: 'server' };
  }
}
