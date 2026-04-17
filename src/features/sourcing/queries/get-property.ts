import 'server-only';

import { db } from '@/server/db';

export async function getProperty(orgId: string, propertyId: string) {
  return db.property.findFirst({
    where: { id: propertyId, organizationId: orgId, deletedAt: null },
    include: {
      project: { select: { name: true } },
      contact: true,
      dealAnalyses: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getProperty>>>;
