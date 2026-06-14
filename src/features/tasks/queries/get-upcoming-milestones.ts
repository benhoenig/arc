import 'server-only';

import { db } from '@/server/db';

// Org-wide unmet milestones with the nearest target dates. Feeds the portfolio
// dashboard's "what's coming up" view (M11). Only milestones not yet hit
// (actual_date IS NULL) are upcoming.
export async function getUpcomingMilestones(orgId: string, limit = 10) {
  return db.milestone.findMany({
    where: { organizationId: orgId, actualDate: null, deletedAt: null },
    select: {
      id: true,
      flipId: true,
      title: true,
      targetDate: true,
      isCritical: true,
      flip: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ targetDate: 'asc' }],
    take: limit,
  });
}

export type UpcomingMilestone = Awaited<ReturnType<typeof getUpcomingMilestones>>[number];
