'use server';

import type { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { auth } from '@/server/auth/neon-auth';
import type { ActionResult } from '@/types/common';
import { changePasswordSchema } from '../validators/auth-schemas';

/**
 * Change the signed-in user's password via Neon Auth (Better Auth). Requires the
 * current password — Better Auth verifies it against the stored hash and rejects
 * a wrong one (surfaced here as `forbidden`).
 *
 * NOTE: we deliberately do NOT pass `revokeOtherSessions: true`. Revoking other
 * sessions invalidates the cached session data, which makes the automatic
 * post-action re-render's `getSession()` (in `getCurrentUser`) try to rewrite
 * the session cookie *during render* — illegal in a Server Component, throwing
 * "Cookies can only be modified in a Server Action or Route Handler". The proper
 * way to support session revocation is to refresh the session cookie in Neon
 * Auth middleware (not currently wired); until then, keep the current session
 * intact on password change. See the change-password follow-up note.
 */
export async function changePassword(
  input: z.infer<typeof changePasswordSchema>,
): Promise<ActionResult<void>> {
  // Ensure there is an authenticated session; the change applies to this user.
  await requireAuth();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { error } = await auth.changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (error) {
    // Most commonly a wrong current password; treat any auth-layer rejection as
    // forbidden rather than leaking the upstream message to the client.
    return { ok: false, error: 'forbidden' };
  }

  return { ok: true, data: undefined };
}
