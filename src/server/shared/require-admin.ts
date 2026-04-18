import 'server-only';

import { db } from '@/server/db';

/**
 * Returns true if the user has the `admin` role in the given org.
 * App-layer gate — RLS only enforces org membership; admin-only actions
 * (inviting, revoking) check this explicitly.
 */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const membership = await db.userRole.findFirst({
    where: {
      userId,
      organizationId: orgId,
      deletedAt: null,
      role: { slug: 'admin' },
    },
    select: { id: true },
  });
  return membership !== null;
}
