'use server';

import type { z } from 'zod';
import { getSupabaseServerClient } from '@/server/supabase/server-client';
import type { ActionResult } from '@/types/common';
import { loginSchema } from '../validators/auth-schemas';

export async function login(input: z.infer<typeof loginSchema>): Promise<ActionResult<void>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: 'forbidden' };
  }

  return { ok: true, data: undefined };
}
