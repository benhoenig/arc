import 'server-only';

import { db } from '@/server/db';

export async function listMilestonesForAssignment(orgId: string, assignmentId: string) {
  const rows = await db.contractorMilestone.findMany({
    where: { organizationId: orgId, assignmentId, deletedAt: null },
    select: {
      id: true,
      assignmentId: true,
      title: true,
      sortOrder: true,
      amountThb: true,
      percentage: true,
      targetDate: true,
      completedAt: true,
      approvedAt: true,
      status: true,
      notes: true,
      createdAt: true,
      payments: {
        where: { deletedAt: null, status: { not: 'canceled' } },
        select: { id: true, status: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return rows.map((r) => ({
    ...r,
    amountThb: Number(r.amountThb),
    percentage: r.percentage != null ? Number(r.percentage) : null,
    // A milestone with a live (non-canceled) payment can't be re-billed.
    hasActivePayment: r.payments.length > 0,
    payments: undefined,
  }));
}

export type MilestoneItem = Awaited<ReturnType<typeof listMilestonesForAssignment>>[number];
