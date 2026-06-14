'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type UpdateMilestoneInput, updateMilestoneSchema } from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function updateMilestone(input: UpdateMilestoneInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...fields } = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
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
      // A paid milestone is settled; editing its amount would desync the ledger.
      if (m.status === 'paid') {
        throw new Error('conflict:milestone_paid');
      }

      await tx.contractorMilestone.update({
        where: { id: m.id },
        data: {
          ...(fields.title !== undefined ? { title: fields.title } : {}),
          ...(fields.amountThb !== undefined ? { amountThb: fields.amountThb } : {}),
          ...(fields.percentage !== undefined ? { percentage: fields.percentage } : {}),
          ...(fields.targetDate !== undefined ? { targetDate: fields.targetDate } : {}),
          ...(fields.sortOrder !== undefined ? { sortOrder: fields.sortOrder } : {}),
          ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_milestone',
        entityId: m.id,
        action: 'updated',
        changes: fields,
      });

      return { flipId: m.assignment.flipId, assignmentId: m.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'updateMilestone');
  }
}
