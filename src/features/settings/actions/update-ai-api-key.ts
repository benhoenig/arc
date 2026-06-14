'use server';

import { revalidatePath } from 'next/cache';
import { encryptSecret, isSecretEncryptionAvailable } from '@/lib/crypto/secret-box';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import { type UpdateAiApiKeyInput, updateAiApiKeySchema } from '../validators/ai-settings-schemas';

/**
 * Store (or replace) the org's own Anthropic API key, encrypted at rest.
 * Admin-only. The plaintext key never leaves this server boundary — we keep
 * only the AES-256-GCM ciphertext plus the last 4 chars for a masked hint.
 */
export async function updateAiApiKey(input: UpdateAiApiKeyInput): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = updateAiApiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  if (!isSecretEncryptionAvailable()) {
    return { ok: false, error: 'conflict', message: 'encryption_not_configured' };
  }

  const apiKey = parsed.data.apiKey;
  const apiKeyEncrypted = encryptSecret(apiKey);
  const apiKeyLast4 = apiKey.slice(-4);

  try {
    await db.$transaction(async (tx) => {
      await tx.orgAiSettings.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          credentialType: 'api_key',
          apiKeyEncrypted,
          apiKeyLast4,
          createdBy: user.id,
          updatedBy: user.id,
        },
        // Switching to an API key clears any stored subscription credential —
        // an org uses exactly one credential (enforced by credential_type).
        update: {
          credentialType: 'api_key',
          apiKeyEncrypted,
          apiKeyLast4,
          oauthAccessTokenEncrypted: null,
          oauthRefreshTokenEncrypted: null,
          oauthAccessLast4: null,
          oauthExpiresAt: null,
          updatedBy: user.id,
        },
      });

      // Audit only — never log the key or its ciphertext.
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_ai_settings',
        entityId: orgId,
        action: 'api_key_updated',
      });
    });

    revalidatePath('/settings/ai');
    return { ok: true, data: undefined };
  } catch (error) {
    console.error('updateAiApiKey failed', error);
    return { ok: false, error: 'server' };
  }
}
