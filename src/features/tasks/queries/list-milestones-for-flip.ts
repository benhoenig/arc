import 'server-only';

import { db } from '@/server/db';

export async function listMilestonesForFlip(orgId: string, flipId: string) {
  return db.milestone.findMany({
    where: { organizationId: orgId, flipId, deletedAt: null },
    select: {
      id: true,
      flipId: true,
      title: true,
      description: true,
      sortOrder: true,
      targetDate: true,
      actualDate: true,
      isCritical: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { targetDate: 'asc' }],
  });
}

export type FlipMilestone = Awaited<ReturnType<typeof listMilestonesForFlip>>[number];
