import 'server-only';

import { db } from '@/server/db';

/**
 * Lists users who belong to the org (via user_roles). Used by the team-member
 * assignment picker.
 */
export async function listOrgUsers(orgId: string) {
  const rows = await db.userRole.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      user: { select: { id: true, fullName: true, displayName: true, email: true } },
    },
    distinct: ['userId'],
  });

  return rows
    .map((r) => r.user)
    .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

export type OrgUserOption = Awaited<ReturnType<typeof listOrgUsers>>[number];
