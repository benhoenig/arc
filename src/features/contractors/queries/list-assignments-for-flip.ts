import 'server-only';

import { db } from '@/server/db';

export async function listAssignmentsForFlip(orgId: string, flipId: string) {
  const rows = await db.contractorAssignment.findMany({
    where: { organizationId: orgId, flipId, deletedAt: null },
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
      createdAt: true,
      contractor: {
        select: { id: true, name: true, primaryTrade: true, contractorType: true },
      },
      budgetCategory: {
        select: { id: true, slug: true, nameTh: true, nameEn: true },
      },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'asc' }, { createdAt: 'desc' }],
  });

  return rows.map((r) => ({
    ...r,
    contractAmountThb: r.contractAmountThb != null ? Number(r.contractAmountThb) : null,
    tmDailyRateThb: r.tmDailyRateThb != null ? Number(r.tmDailyRateThb) : null,
    tmHourlyRateThb: r.tmHourlyRateThb != null ? Number(r.tmHourlyRateThb) : null,
    tmMaterialMarkupPct: r.tmMaterialMarkupPct != null ? Number(r.tmMaterialMarkupPct) : null,
    totalCommittedThb: Number(r.totalCommittedThb),
    totalPaidThb: Number(r.totalPaidThb),
  }));
}

export type AssignmentItem = Awaited<ReturnType<typeof listAssignmentsForFlip>>[number];
