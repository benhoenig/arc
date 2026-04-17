import 'server-only';

import { db } from '@/server/db';

export async function listProperties(orgId: string) {
  return db.property.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      nickname: true,
      district: true,
      province: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      floorAreaSqm: true,
      createdAt: true,
      _count: {
        select: { dealAnalyses: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>[number];
