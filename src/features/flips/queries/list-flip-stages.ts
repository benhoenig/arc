import 'server-only';

import { db } from '@/server/db';

export async function listFlipStages(orgId: string) {
  return db.flipStage.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      sortOrder: true,
      stageType: true,
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export type FlipStageOption = Awaited<ReturnType<typeof listFlipStages>>[number];
