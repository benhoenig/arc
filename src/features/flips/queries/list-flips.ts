import 'server-only';

import { db } from '@/server/db';

export type FlipListFilter = 'all' | 'active' | 'closed';

export async function listFlips(orgId: string, filter: FlipListFilter = 'all') {
  const rows = await db.flip.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      ...(filter === 'active' ? { soldAt: null, killedAt: null } : {}),
      ...(filter === 'closed'
        ? { OR: [{ soldAt: { not: null } }, { killedAt: { not: null } }] }
        : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      baselineTargetArvThb: true,
      baselineTargetMarginPct: true,
      actualSalePriceThb: true,
      acquiredAt: true,
      soldAt: true,
      killedAt: true,
      isOnHold: true,
      createdAt: true,
      stage: {
        select: { id: true, slug: true, nameTh: true, nameEn: true, stageType: true },
      },
      property: {
        select: { id: true, listingName: true, thumbnailPath: true },
      },
      _count: {
        select: { teamMembers: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    ...row,
    baselineTargetArvThb:
      row.baselineTargetArvThb != null ? Number(row.baselineTargetArvThb) : null,
    baselineTargetMarginPct:
      row.baselineTargetMarginPct != null ? Number(row.baselineTargetMarginPct) : null,
    actualSalePriceThb: row.actualSalePriceThb != null ? Number(row.actualSalePriceThb) : null,
  }));
}

export type FlipListItem = Awaited<ReturnType<typeof listFlips>>[number];
