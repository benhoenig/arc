import 'server-only';

import { db } from '@/server/db';

export async function getProperty(orgId: string, propertyId: string) {
  return db.property.findFirst({
    where: { id: propertyId, organizationId: orgId, deletedAt: null },
    include: {
      dealAnalyses: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getProperty>>>;
