import { auth } from '@/server/auth/neon-auth';

/**
 * Catch-all proxy for Neon Auth: sign-in/up, sign-out, OAuth callbacks,
 * email verification, session refresh. Lives under /api so the next-intl
 * middleware matcher (which excludes /api) leaves it alone.
 */
export const { GET, POST } = auth.handler();
