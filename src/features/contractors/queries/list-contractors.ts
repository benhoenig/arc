import 'server-only';

import { db } from '@/server/db';

export async function listContractors(orgId: string) {
  const rows = await db.contractor.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      contractorType: true,
      primaryTrade: true,
      additionalTrades: true,
      contactPerson: true,
      phone: true,
      lineId: true,
      email: true,
      defaultDailyRateThb: true,
      defaultHourlyRateThb: true,
      totalAssignmentsCount: true,
      totalPaidThb: true,
      lastAssignmentAt: true,
      createdAt: true,
      _count: {
        select: {
          assignments: { where: { status: 'active', deletedAt: null } },
        },
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contractorType: r.contractorType,
    primaryTrade: r.primaryTrade,
    additionalTrades: r.additionalTrades,
    contactPerson: r.contactPerson,
    phone: r.phone,
    lineId: r.lineId,
    email: r.email,
    defaultDailyRateThb: r.defaultDailyRateThb != null ? Number(r.defaultDailyRateThb) : null,
    defaultHourlyRateThb: r.defaultHourlyRateThb != null ? Number(r.defaultHourlyRateThb) : null,
    totalAssignmentsCount: r.totalAssignmentsCount,
    totalPaidThb: Number(r.totalPaidThb),
    lastAssignmentAt: r.lastAssignmentAt,
    activeAssignmentsCount: r._count.assignments,
    createdAt: r.createdAt,
  }));
}

export type ContractorListItem = Awaited<ReturnType<typeof listContractors>>[number];
