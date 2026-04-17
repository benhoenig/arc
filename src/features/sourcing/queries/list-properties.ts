import 'server-only';

import { db } from '@/server/db';

export async function listProperties(orgId: string) {
  return db.property.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      listingName: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      floorAreaSqm: true,
      floors: true,
      floorLevel: true,
      askingPriceThb: true,
      sourcingStatus: true,
      project: { select: { name: true } },
      contact: { select: { name: true, contactType: true } },
      createdAt: true,
      _count: {
        select: { dealAnalyses: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>[number];
