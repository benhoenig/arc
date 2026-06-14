'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { deleteMilestoneSchema } from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function deleteMilestone(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = deleteMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id } = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
      const m = await tx.contractorMilestone.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          assignmentId: true,
          assignment: { select: { flipId: true } },
          payments: {
            where: { deletedAt: null, status: { not: 'canceled' } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!m) {
        throw new Error('not_found');
      }
      // Don't orphan a payment that references this milestone.
      if (m.payments.length > 0) {
        throw new Error('conflict:has_payment');
      }

      await tx.contractorMilestone.update({
        where: { id: m.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_milestone',
        entityId: m.id,
        action: 'deleted',
        changes: {},
      });

      return { flipId: m.assignment.flipId, assignmentId: m.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'deleteMilestone');
  }
}
