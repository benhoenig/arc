'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/server/auth/neon-auth';

export async function logout(): Promise<void> {
  await auth.signOut();
  redirect('/login');
}
