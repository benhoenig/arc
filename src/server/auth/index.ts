import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '@/server/db';
import { auth } from './neon-auth';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Returns the current authenticated user, or `null` if there is no active
 * session. Signature-compatible with the previous Supabase implementation so
 * callers don't change.
 *
 * Wrapped in React `cache()` so the layout and the page it renders share a
 * single session resolution per request instead of each re-hitting Neon Auth.
 *
 * This is a pure read — it deliberately does NOT mirror the identity into
 * `public.users`. That row is created once, at account creation: both `signup`
 * and `acceptInvitation` upsert it inside their provisioning transaction, so it
 * is guaranteed to exist by the time anyone is authenticated. The previous lazy
 * `INSERT ... ON CONFLICT` ran on every page load — a write on the hot path for
 * no benefit. If an OAuth/social sign-up path is ever added, mirror the row in
 * that callback the same way; do not reintroduce a per-request write here.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };
});

export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Resolve the caller's active organization. Cached per request so repeated
 * calls (the layout, then the page) reuse one `user_roles` lookup.
 */
export const getActiveOrgId = cache(async (): Promise<string> => {
  const user = await requireAuth();

  const role = await db.userRole.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { organizationId: true },
  });

  if (!role) {
    throw new Error('User has no organization membership');
  }

  return role.organizationId;
});
