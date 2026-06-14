'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type MilestoneStatus,
  milestoneIsBillable,
  type RequestPaymentInput,
  requestPaymentSchema,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

// Open a payment request against either one billable milestone or the batch of
// currently-approved T&M entries on an assignment. Amount is resolved on the
// server from the source — never trusted from the client.
export async function requestPayment(
  input: RequestPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = requestPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      if (data.source === 'milestone') {
        const m = await tx.contractorMilestone.findFirst({
          where: { id: data.milestoneId, organizationId: orgId, deletedAt: null },
          select: {
            id: true,
            status: true,
            amountThb: true,
            title: true,
            assignmentId: true,
            assignment: {
              select: {
                contractorId: true,
                flipId: true,
                flip: { select: { killedAt: true, soldAt: true } },
              },
            },
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
        if (m.assignment.flip.killedAt || m.assignment.flip.soldAt) {
          throw new Error('conflict:flip_closed');
        }
        if (!milestoneIsBillable(m.status as MilestoneStatus)) {
          throw new Error('conflict:milestone_not_billable');
        }
        if (m.payments.length > 0) {
          throw new Error('conflict:milestone_already_billed');
        }

        const row = await tx.contractorPayment.create({
          data: {
            organizationId: orgId,
            assignmentId: m.assignmentId,
            contractorId: m.assignment.contractorId,
            flipId: m.assignment.flipId,
            milestoneId: m.id,
            amountThb: m.amountThb,
            status: 'requested',
            requestedBy: user.id,
            notes: data.notes ?? null,
          },
          select: { id: true },
        });

        await logActivity(tx, {
          orgId,
          userId: user.id,
          entityType: 'contractor_payment',
          entityId: row.id,
          action: 'requested',
          changes: { source: 'milestone', milestoneId: m.id, amountThb: Number(m.amountThb) },
        });

        return { id: row.id, flipId: m.assignment.flipId, assignmentId: m.assignmentId };
      }

      // tm_batch
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id: data.assignmentId, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          contractorId: true,
          flipId: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const entries = await tx.contractorTmEntry.findMany({
        where: { assignmentId: assignment.id, status: 'approved', deletedAt: null },
        select: { id: true, lineTotalThb: true },
      });
      if (entries.length === 0) {
        throw new Error('conflict:no_approved_entries');
      }

      const total = entries.reduce((sum, e) => sum + Number(e.lineTotalThb), 0);

      const row = await tx.contractorPayment.create({
        data: {
          organizationId: orgId,
          assignmentId: assignment.id,
          contractorId: assignment.contractorId,
          flipId: assignment.flipId,
          amountThb: total,
          status: 'requested',
          requestedBy: user.id,
          notes: data.notes ?? null,
          // Covered entries recorded here so markPaymentPaid settles exactly
          // these rows (no FK column for the payment↔entry batch in the schema).
          metadata: { tmEntryIds: entries.map((e) => e.id) },
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_payment',
        entityId: row.id,
        action: 'requested',
        changes: { source: 'tm_batch', entryCount: entries.length, amountThb: total },
      });

      return { id: row.id, flipId: assignment.flipId, assignmentId: assignment.id };
    });

    revalidatePath(`/flips/${result.flipId}/contractors/${result.assignmentId}`);
    revalidatePath('/contractors/payments');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return mapPaymentError(error, 'requestPayment');
  }
}
