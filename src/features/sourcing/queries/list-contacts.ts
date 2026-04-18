import 'server-only';

import { db } from '@/server/db';

export async function listContacts(orgId: string) {
  return db.contact.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      contactType: true,
      phone: true,
      lineId: true,
      email: true,
      createdAt: true,
      _count: {
        select: { properties: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];
