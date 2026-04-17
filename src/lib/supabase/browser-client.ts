'use client';

import { createBrowserClient } from '@supabase/ssr';

// NEXT_PUBLIC_ vars are inlined at build time by Next.js — exempt from the
// "no process.env outside env.ts" rule since env.ts is server-only.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
