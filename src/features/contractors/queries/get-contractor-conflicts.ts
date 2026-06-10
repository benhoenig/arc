import 'server-only';

import { db } from '@/server/db';

// Returns active / draft assignments for a contractor whose date range
// overlaps the proposed (startDate, targetEndDate). Used for the Q7 conflict
// warning when creating a new assignment. Overlap rule: two ranges [aS, aE]
// and [bS, bE] overlap iff aS <= bE and bS <= aE. Missing endpoints are
// treated as open-ended (counts as overlap).
export async function getContractorConflicts(
  orgId: string,
  contractorId: string,
  startDate: Date | string | null,
  targetEndDate: Date | string | null,
  excludeAssignmentId?: string,
) {
  const start = startDate ? new Date(startDate) : null;
  const end = targetEndDate ? new Date(targetEndDate) : null;

  const rows = await db.contractorAssignment.findMany({
    where: {
      organizationId: orgId,
      contractorId,
      status: { in: ['draft', 'active'] },
      deletedAt: null,
      ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      // Overlap: existing.startDate <= proposed.end  AND  existing.end >= proposed.start
      // Null endpoint on either side is treated as open-ended (overlaps).
      ...(end ? { OR: [{ startDate: null }, { startDate: { lte: end } }] } : {}),
      ...(start
        ? { AND: [{ OR: [{ targetEndDate: null }, { targetEndDate: { gte: start } }] }] }
        : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      targetEndDate: true,
      flip: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ startDate: 'asc' }],
  });

  return rows;
}
