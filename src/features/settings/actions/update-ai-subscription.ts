'use server';

import { revalidatePath } from 'next/cache';
import { parseSubscriptionCredential, SubscriptionCredentialError } from '@/lib/anthropic/oauth';
import { encryptSecret, isSecretEncryptionAvailable } from '@/lib/crypto/secret-box';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import {
  type UpdateAiSubscriptionInput,
  updateAiSubscriptionSchema,
} from '../validators/ai-settings-schemas';

/**
 * Store (or replace) the org's Claude *subscription* credential, encrypted at
 * rest. Admin-only. The operator pastes the credential blob from their local
 * Claude Code login (`security find-generic-password -s "Claude Code-credentials" -w`).
 *
 * We store the pasted token pair as-is (no immediate refresh) so we don't
 * instantly rotate the token out from under the operator's Claude Code session.
 * The OCR token store refreshes server-side when the access token expires.
 * Connecting a subscription clears any stored API key — one credential per org.
 * Plaintext tokens never leave this server boundary.
 */
export async function updateAiSubscription(
  input: UpdateAiSubscriptionInput,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = updateAiSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  if (!isSecretEncryptionAvailable()) {
    return { ok: false, error: 'conflict', message: 'encryption_not_configured' };
  }

  let credential: ReturnType<typeof parseSubscriptionCredential>;
  try {
    credential = parseSubscriptionCredential(parsed.data.credential);
  } catch (error) {
    if (error instanceof SubscriptionCredentialError) {
      return { ok: false, error: 'conflict', message: 'invalid_credential' };
    }
    throw error;
  }

  const oauthAccessTokenEncrypted = encryptSecret(credential.accessToken);
  const oauthRefreshTokenEncrypted = encryptSecret(credential.refreshToken);
  const oauthAccessLast4 = credential.accessToken.slice(-4);
  // No expiry in the blob → force a refresh on first use.
  const oauthExpiresAt = new Date(credential.expiresAt > 0 ? credential.expiresAt : Date.now());

  try {
    await db.$transaction(async (tx) => {
      await tx.orgAiSettings.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          credentialType: 'oauth',
          oauthAccessTokenEncrypted,
          oauthRefreshTokenEncrypted,
          oauthAccessLast4,
          oauthExpiresAt,
          createdBy: user.id,
          updatedBy: user.id,
        },
        update: {
          credentialType: 'oauth',
          oauthAccessTokenEncrypted,
          oauthRefreshTokenEncrypted,
          oauthAccessLast4,
          oauthExpiresAt,
          apiKeyEncrypted: null,
          apiKeyLast4: null,
          updatedBy: user.id,
        },
      });

      // Audit only — never log a token or its ciphertext.
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_ai_settings',
        entityId: orgId,
        action: 'subscription_connected',
      });
    });

    revalidatePath('/settings/ai');
    return { ok: true, data: undefined };
  } catch (error) {
    console.error('updateAiSubscription failed', error);
    return { ok: false, error: 'server' };
  }
}
