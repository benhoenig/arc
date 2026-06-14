import 'server-only';

import { db } from '@/server/db';

export async function listTmEntriesForAssignment(orgId: string, assignmentId: string) {
  const rows = await db.contractorTmEntry.findMany({
    where: { organizationId: orgId, assignmentId, deletedAt: null },
    select: {
      id: true,
      assignmentId: true,
      entryType: true,
      entryDate: true,
      description: true,
      hoursWorked: true,
      daysWorked: true,
      appliedRateThb: true,
      materialCostThb: true,
      materialMarkupPct: true,
      receiptPath: true,
      lineTotalThb: true,
      status: true,
      approvedAt: true,
      notes: true,
      createdAt: true,
    },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.map((r) => ({
    ...r,
    hoursWorked: r.hoursWorked != null ? Number(r.hoursWorked) : null,
    daysWorked: r.daysWorked != null ? Number(r.daysWorked) : null,
    appliedRateThb: r.appliedRateThb != null ? Number(r.appliedRateThb) : null,
    materialCostThb: r.materialCostThb != null ? Number(r.materialCostThb) : null,
    materialMarkupPct: r.materialMarkupPct != null ? Number(r.materialMarkupPct) : null,
    lineTotalThb: Number(r.lineTotalThb),
  }));
}

export type TmEntryItem = Awaited<ReturnType<typeof listTmEntriesForAssignment>>[number];
