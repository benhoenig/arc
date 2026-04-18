import 'server-only';

import { db } from '@/server/db';

export async function listOrgRoles(orgId: string) {
  return db.role.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { slug: true, nameTh: true, nameEn: true },
    orderBy: { slug: 'asc' },
  });
}

export type OrgRoleOption = Awaited<ReturnType<typeof listOrgRoles>>[number];
