import 'server-only';

import { db } from '@/server/db';

export async function listProjects(orgId: string) {
  return db.project.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      developer: true,
      location: true,
      propertyType: true,
      createdAt: true,
      _count: {
        select: { properties: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];
