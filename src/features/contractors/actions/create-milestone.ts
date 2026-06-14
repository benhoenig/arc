'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type CreateMilestoneInput, createMilestoneSchema } from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function createMilestone(
  input: CreateMilestoneInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id: data.assignmentId, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          paymentModel: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      if (assignment.paymentModel !== 'fixed_milestone') {
        throw new Error('conflict:wrong_payment_model');
      }

      let sortOrder = data.sortOrder;
      if (sortOrder == null) {
        const last = await tx.contractorMilestone.findFirst({
          where: { assignmentId: assignment.id, deletedAt: null },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        sortOrder = (last?.sortOrder ?? -1) + 1;
      }

      const row = await tx.contractorMilestone.create({
        data: {
          organizationId: orgId,
          assignmentId: assignment.id,
          title: data.title,
          amountThb: data.amountThb,
          percentage: data.percentage ?? null,
          targetDate: data.targetDate ?? null,
          sortOrder,
          notes: data.notes ?? null,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_milestone',
        entityId: row.id,
        action: 'created',
        changes: { assignmentId: assignment.id, title: data.title, amountThb: data.amountThb },
      });

      return { id: row.id, flipId: assignment.flipId };
    });

    revalidatePath(`/flips/${result.flipId}/contractors/${data.assignmentId}`);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return mapPaymentError(error, 'createMilestone');
  }
}
