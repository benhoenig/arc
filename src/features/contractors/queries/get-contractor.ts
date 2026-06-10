import 'server-only';

import { db } from '@/server/db';

export async function getContractorById(orgId: string, contractorId: string) {
  const row = await db.contractor.findFirst({
    where: { id: contractorId, organizationId: orgId, deletedAt: null },
    include: {
      assignments: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          paymentModel: true,
          contractAmountThb: true,
          startDate: true,
          targetEndDate: true,
          actualEndDate: true,
          totalPaidThb: true,
          flip: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    contractorType: row.contractorType,
    primaryTrade: row.primaryTrade,
    additionalTrades: row.additionalTrades,
    contactPerson: row.contactPerson,
    phone: row.phone,
    lineId: row.lineId,
    email: row.email,
    address: row.address,
    taxId: row.taxId,
    defaultDailyRateThb: row.defaultDailyRateThb != null ? Number(row.defaultDailyRateThb) : null,
    defaultHourlyRateThb:
      row.defaultHourlyRateThb != null ? Number(row.defaultHourlyRateThb) : null,
    totalAssignmentsCount: row.totalAssignmentsCount,
    totalPaidThb: Number(row.totalPaidThb),
    avgOnTimePct: row.avgOnTimePct != null ? Number(row.avgOnTimePct) : null,
    avgQualityRating: row.avgQualityRating != null ? Number(row.avgQualityRating) : null,
    lastAssignmentAt: row.lastAssignmentAt,
    notes: row.notes,
    createdAt: row.createdAt,
    assignments: row.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      paymentModel: a.paymentModel,
      contractAmountThb: a.contractAmountThb != null ? Number(a.contractAmountThb) : null,
      startDate: a.startDate,
      targetEndDate: a.targetEndDate,
      actualEndDate: a.actualEndDate,
      totalPaidThb: Number(a.totalPaidThb),
      flip: a.flip,
    })),
  };
}

export type ContractorDetail = NonNullable<Awaited<ReturnType<typeof getContractorById>>>;
