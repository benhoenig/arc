import 'server-only';

import { db } from '@/server/db';

export async function listProperties(orgId: string) {
  const rows = await db.property.findMany({
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
      thumbnailPath: true,
      project: { select: { name: true } },
      contact: { select: { name: true, contactType: true } },
      createdAt: true,
      _count: {
        select: { dealAnalyses: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Convert Prisma Decimal objects to plain numbers for client serialization
  return rows.map((row) => ({
    ...row,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : null,
    floorAreaSqm: row.floorAreaSqm != null ? Number(row.floorAreaSqm) : null,
    askingPriceThb: row.askingPriceThb != null ? Number(row.askingPriceThb) : null,
  }));
}

export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>[number];
