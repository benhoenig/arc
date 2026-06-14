import 'server-only';

import { db } from '@/server/db';

// Single assignment with the context the assignment-detail page needs:
// contractor, flip, budget category, and the linked budget line (if any).
export async function getAssignment(orgId: string, assignmentId: string) {
  const r = await db.contractorAssignment.findFirst({
    where: { id: assignmentId, organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      flipId: true,
      contractorId: true,
      budgetCategoryId: true,
      title: true,
      scopeOfWork: true,
      startDate: true,
      targetEndDate: true,
      actualEndDate: true,
      paymentModel: true,
      contractAmountThb: true,
      tmDailyRateThb: true,
      tmHourlyRateThb: true,
      tmMaterialMarkupPct: true,
      totalCommittedThb: true,
      totalPaidThb: true,
      status: true,
      notes: true,
      contractor: {
        select: { id: true, name: true, primaryTrade: true, contractorType: true },
      },
      flip: { select: { id: true, code: true, name: true, killedAt: true, soldAt: true } },
      budgetCategory: { select: { id: true, slug: true, nameTh: true, nameEn: true } },
      budgetLines: {
        where: { deletedAt: null },
        select: { id: true, description: true, categoryId: true },
        take: 1,
      },
    },
  });

  if (!r) {
    return null;
  }

  return {
    ...r,
    contractAmountThb: r.contractAmountThb != null ? Number(r.contractAmountThb) : null,
    tmDailyRateThb: r.tmDailyRateThb != null ? Number(r.tmDailyRateThb) : null,
    tmHourlyRateThb: r.tmHourlyRateThb != null ? Number(r.tmHourlyRateThb) : null,
    tmMaterialMarkupPct: r.tmMaterialMarkupPct != null ? Number(r.tmMaterialMarkupPct) : null,
    totalCommittedThb: Number(r.totalCommittedThb),
    totalPaidThb: Number(r.totalPaidThb),
    linkedBudgetLine: r.budgetLines[0] ?? null,
  };
}

export type AssignmentDetail = NonNullable<Awaited<ReturnType<typeof getAssignment>>>;
