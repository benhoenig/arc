import 'server-only';

import { db } from '@/server/db';

export async function getProject(orgId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: orgId, deletedAt: null },
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

  if (!project) {
    return null;
  }

  return {
    ...project,
    properties: project.properties.map((p) => ({
      ...p,
      askingPriceThb: p.askingPriceThb != null ? Number(p.askingPriceThb) : null,
    })),
  };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
