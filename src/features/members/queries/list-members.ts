import 'server-only';

import { db } from '@/server/db';

export async function listMembers(orgId: string) {
  const rows = await db.userRole.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      createdAt: true,
      user: {
        select: { id: true, fullName: true, displayName: true, email: true },
      },
      role: { select: { slug: true, nameTh: true, nameEn: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    joinedAt: r.createdAt,
    user: r.user,
    role: r.role,
  }));
}

export type MemberListItem = Awaited<ReturnType<typeof listMembers>>[number];
