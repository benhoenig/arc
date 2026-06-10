import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';
import { env } from '@/lib/env';

/**
 * The single server-side Neon Auth (Better Auth) instance.
 *
 * Provides `.getSession()`, `.signIn`, `.signUp`, `.signOut`, and `.handler()`
 * (for the `/api/auth/[...path]` route). Session data is cached in a signed,
 * HTTP-only cookie (HMAC-SHA256) to avoid an upstream call on every request.
 *
 * Identity lives in the managed `neon_auth.*` schema inside the same Neon DB.
 * `session.user.id` is a `uuid` that equals `public.users.id` — the same
 * mapping Supabase's `auth.users.id` had, so nothing downstream changes.
 */
export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
  },
});
