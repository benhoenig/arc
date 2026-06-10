import 'server-only';

import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { auth } from './neon-auth';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Mirror the authenticated Neon Auth identity into `public.users`.
 *
 * Replaces the old `handle_new_auth_user` trigger on `auth.users`. We do this
 * in app code (not a trigger on the managed `neon_auth` schema) so it survives
 * Neon Auth re-provisioning and covers email + Google-OAuth sign-ups uniformly.
 *
 * `ON CONFLICT (id) DO NOTHING` makes it idempotent and cheap — once the row
 * exists (created at sign-up), this is a single no-op insert.
 */
async function ensureAppUser(user: AppUser): Promise<void> {
  await db.$executeRaw`
    INSERT INTO users (id, email, full_name, display_name)
    VALUES (${user.id}::uuid, ${user.email}, ${user.name}, ${user.name})
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Returns the current authenticated user (mirrored into `public.users`), or
 * `null` if there is no active session. Signature-compatible with the previous
 * Supabase implementation so callers don't change.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.id || !user.email) {
    return null;
  }

  const appUser: AppUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };

  await ensureAppUser(appUser);
  return appUser;
}

export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function getActiveOrgId(): Promise<string> {
  const user = await requireAuth();

  const role = await db.userRole.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { organizationId: true },
  });

  if (!role) {
    throw new Error('User has no organization membership');
  }

  return role.organizationId;
}
