'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  canTransitionTmEntryStatus,
  setTmEntryStatusSchema,
  type TmEntryStatus,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

// Approve / reject / reopen a T&M entry. `paid` is set only by markPaymentPaid.
export async function setTmEntryStatus(input: {
  id: string;
  status: TmEntryStatus;
}): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = setTmEntryStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, status: nextStatus } = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
      const e = await tx.contractorTmEntry.findFirst({
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
      if (!e) {
        throw new Error('not_found');
      }
      if (e.assignment.flip.killedAt || e.assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const current = e.status as TmEntryStatus;
      if (current === nextStatus) {
        return { flipId: e.assignment.flipId, assignmentId: e.assignmentId };
      }
      if (nextStatus === 'paid') {
        throw new Error('conflict:paid_set_by_payment');
      }
      if (!canTransitionTmEntryStatus(current, nextStatus)) {
        throw new Error('conflict:invalid_status_transition');
      }

      await tx.contractorTmEntry.update({
        where: { id: e.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'approved' ? { approvedAt: new Date(), approvedBy: user.id } : {}),
          ...(nextStatus === 'pending' ? { approvedAt: null, approvedBy: null } : {}),
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_tm_entry',
        entityId: e.id,
        action: 'status_changed',
        changes: { from: current, to: nextStatus },
      });

      return { flipId: e.assignment.flipId, assignmentId: e.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'setTmEntryStatus');
  }
}
