import 'server-only';

import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { getSupabaseServerClient } from './server-client';

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
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
