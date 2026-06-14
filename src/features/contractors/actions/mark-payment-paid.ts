'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { toSignedAmount } from '@/features/budget/validators/transaction-schemas';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { type MarkPaymentPaidInput, markPaymentPaidSchema } from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

// The keystone of M6: an approved payment is marked paid. In one transaction we
//   1. flip the payment to `paid` (fires the total_paid rollup trigger),
//   2. emit a flip_transactions `spend` row on the assignment's budget line —
//      auto-creating that line if the assignment has none (decided: option B) —
//      which fires recompute_budget_line_actual so the budget actual updates,
//   3. settle the source: milestone → `paid`, or the batch's T&M entries → `paid`.
// Budget sync is app-code (not a DB trigger) so the ledger row carries
// created_by / description. See DATA_MODEL §14.4.
export async function markPaymentPaid(input: MarkPaymentPaidInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = markPaymentPaidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
      const payment = await tx.contractorPayment.findFirst({
        where: { id: data.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          status: true,
          amountThb: true,
          flipId: true,
          assignmentId: true,
          milestoneId: true,
          metadata: true,
          contractor: { select: { name: true } },
          assignment: { select: { title: true, budgetCategoryId: true } },
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!payment) {
        throw new Error('not_found');
      }
      // Stay consistent with the ledger invariant: no transactions on a closed
      // flip. (Paying contractors on a sold/killed flip is a deferred case.)
      if (payment.flip.killedAt || payment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      // Approval gate: only an approved payment can be paid.
      if (payment.status !== 'approved') {
        throw new Error('conflict:not_approved');
      }

      const budgetLineId = await resolveBudgetLine(tx, {
        orgId,
        flipId: payment.flipId,
        assignmentId: payment.assignmentId,
        assignmentCategoryId: payment.assignment.budgetCategoryId,
        label: payment.assignment.title,
        userId: user.id,
      });

      const paidAt = data.paidAt ?? new Date();
      const amount = Number(payment.amountThb);

      await tx.contractorPayment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference ?? null,
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });

      // Ledger spend row — signed negative; fires the budget actual trigger.
      await tx.flipTransaction.create({
        data: {
          organizationId: orgId,
          flipId: payment.flipId,
          budgetLineId,
          date: paidAt,
          amountThb: toSignedAmount('spend', amount),
          description: `จ่ายผู้รับเหมา ${payment.contractor.name} — ${payment.assignment.title}`,
          kind: 'spend',
          contractorPaymentId: payment.id,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      // Settle the source.
      if (payment.milestoneId) {
        await tx.contractorMilestone.update({
          where: { id: payment.milestoneId },
          data: { status: 'paid' },
        });
      } else {
        const tmEntryIds = readTmEntryIds(payment.metadata);
        if (tmEntryIds.length > 0) {
          await tx.contractorTmEntry.updateMany({
            where: {
              id: { in: tmEntryIds },
              organizationId: orgId,
              status: 'approved',
              deletedAt: null,
            },
            data: { status: 'paid' },
          });
        }
      }

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_payment',
        entityId: payment.id,
        action: 'paid',
        changes: { amountThb: amount, budgetLineId, paymentMethod: data.paymentMethod },
      });

      return { flipId: payment.flipId, assignmentId: payment.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    revalidatePath(`/flips/${loc.flipId}/budget`);
    revalidatePath(`/flips/${loc.flipId}`);
    revalidatePath('/contractors/payments');
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'markPaymentPaid');
  }
}

// Find the budget line already linked to this assignment; if none, create one
// (option B). Category = the assignment's budget category, else the org's
// `contingency` fallback, else the first category. Errors only if the org has
// no categories at all (impossible post-seed).
async function resolveBudgetLine(
  tx: Prisma.TransactionClient,
  args: {
    orgId: string;
    flipId: string;
    assignmentId: string;
    assignmentCategoryId: string | null;
    label: string;
    userId: string;
  },
): Promise<string> {
  const existing = await tx.budgetLine.findFirst({
    where: {
      organizationId: args.orgId,
      flipId: args.flipId,
      contractorAssignmentId: args.assignmentId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  let categoryId = args.assignmentCategoryId;
  if (!categoryId) {
    const fallback =
      (await tx.budgetCategory.findFirst({
        where: { organizationId: args.orgId, slug: 'contingency', deletedAt: null },
        select: { id: true },
      })) ??
      (await tx.budgetCategory.findFirst({
        where: { organizationId: args.orgId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      }));
    if (!fallback) {
      throw new Error('conflict:no_budget_category');
    }
    categoryId = fallback.id;
  }

  const line = await tx.budgetLine.create({
    data: {
      organizationId: args.orgId,
      flipId: args.flipId,
      categoryId,
      description: args.label,
      contractorAssignmentId: args.assignmentId,
      createdBy: args.userId,
      updatedBy: args.userId,
    },
    select: { id: true },
  });
  return line.id;
}

function readTmEntryIds(metadata: Prisma.JsonValue): string[] {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const ids = (metadata as Record<string, unknown>).tmEntryIds;
    if (Array.isArray(ids)) {
      return ids.filter((x): x is string => typeof x === 'string');
    }
  }
  return [];
}
