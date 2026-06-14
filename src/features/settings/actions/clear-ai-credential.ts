'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';

/**
 * Remove the org's stored AI credential — whichever is active (API key OR
 * subscription). Extraction then falls back to the env credential (if any).
 * Admin-only. The model override (if set) is preserved.
 */
export async function clearAiCredential(): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  try {
    const existing = await db.orgAiSettings.findUnique({
      where: { organizationId: orgId },
      select: { id: true, credentialType: true },
    });

    // Nothing stored — nothing to clear. Idempotent success.
    if (!existing?.credentialType) {
      return { ok: true, data: undefined };
    }

    await db.$transaction(async (tx) => {
      await tx.orgAiSettings.update({
        where: { organizationId: orgId },
        data: {
          credentialType: null,
          apiKeyEncrypted: null,
          apiKeyLast4: null,
          oauthAccessTokenEncrypted: null,
          oauthRefreshTokenEncrypted: null,
          oauthAccessLast4: null,
          oauthExpiresAt: null,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_ai_settings',
        entityId: orgId,
        action: 'credential_cleared',
      });
    });

    revalidatePath('/settings/ai');
    return { ok: true, data: undefined };
  } catch (error) {
    console.error('clearAiCredential failed', error);
    return { ok: false, error: 'server' };
  }
}
