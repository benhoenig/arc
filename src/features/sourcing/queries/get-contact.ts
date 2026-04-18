import 'server-only';

import { db } from '@/server/db';

export async function getContact(orgId: string, contactId: string) {
  const row = await db.contact.findFirst({
    where: { id: contactId, organizationId: orgId, deletedAt: null },
    include: {
      properties: {
        where: { deletedAt: null },
        select: {
          id: true,
          listingName: true,
          propertyType: true,
          askingPriceThb: true,
          sourcingStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...row,
    properties: row.properties.map((p) => ({
      ...p,
      askingPriceThb: p.askingPriceThb != null ? Number(p.askingPriceThb) : null,
    })),
  };
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContact>>>;
