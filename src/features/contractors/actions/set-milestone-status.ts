'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  canTransitionMilestoneStatus,
  type MilestoneStatus,
  setMilestoneStatusSchema,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

// Manual milestone transitions (pending → in_progress → completed → approved,
// plus disputed). `paid` is reached only through markPaymentPaid.
export async function setMilestoneStatus(input: {
  id: string;
  status: MilestoneStatus;
}): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = setMilestoneStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, status: nextStatus } = parsed.data;

  try {
    const flipId = await db.$transaction(async (tx) => {
      const m = await tx.contractorMilestone.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assignmentId: true,
          assignment: {
            select: { flipId: true, flip: { select: { killedAt: true, soldAt: true } } },
          },
        },
      });
      if (!m) {
        throw new Error('not_found');
      }
      if (m.assignment.flip.killedAt || m.assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const current = m.status as MilestoneStatus;
      if (current === nextStatus) {
        return { flipId: m.assignment.flipId, assignmentId: m.assignmentId };
      }
      if (nextStatus === 'paid') {
        throw new Error('conflict:paid_set_by_payment');
      }
      if (!canTransitionMilestoneStatus(current, nextStatus)) {
        throw new Error('conflict:invalid_status_transition');
      }

      await tx.contractorMilestone.update({
        where: { id: m.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'completed' ? { completedAt: new Date(), completedBy: user.id } : {}),
          ...(nextStatus === 'approved' ? { approvedAt: new Date(), approvedBy: user.id } : {}),
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_milestone',
        entityId: m.id,
        action: 'status_changed',
        changes: { from: current, to: nextStatus },
      });

      return { flipId: m.assignment.flipId, assignmentId: m.assignmentId };
    });

    revalidatePath(`/flips/${flipId.flipId}/contractors/${flipId.assignmentId}`);
    revalidatePath(`/flips/${flipId.flipId}/contractors`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'setMilestoneStatus');
  }
}
