import 'server-only';

import { isSecretEncryptionAvailable } from '@/lib/crypto/secret-box';
import { env } from '@/lib/env';
import { db } from '@/server/db';

export type AiKeySource = 'org' | 'env' | 'none';
export type AiCredentialType = 'api_key' | 'oauth';

export type AiSettingsStatus = {
  /** Where a usable extraction credential currently comes from. */
  source: AiKeySource;
  /** Which credential the org has stored, or null when none. */
  orgCredentialType: AiCredentialType | null;
  /** Last 4 chars of the org-stored API key, for masked display. Null otherwise. */
  keyLast4: string | null;
  /** Last 4 chars of the org subscription access token, for masked display. */
  subscriptionLast4: string | null;
  /** Explicit per-org model override, or null when falling back to the default. */
  orgModel: string | null;
  /** Model actually used at extraction time (org override ?? env default). */
  effectiveModel: string;
  /** Whether SECRET_ENCRYPTION_KEY is configured — required to store a secret. */
  encryptionAvailable: boolean;
};

/**
 * Read-only status for the AI-settings page. Deliberately NEVER returns a key
 * or token itself — only the last-4 hint and where the active credential
 * resolves from.
 */
export async function getAiSettings(orgId: string): Promise<AiSettingsStatus> {
  const row = await db.orgAiSettings.findUnique({
    where: { organizationId: orgId },
    select: {
      credentialType: true,
      apiKeyLast4: true,
      oauthAccessLast4: true,
      model: true,
    },
  });

  const orgCredentialType: AiCredentialType | null =
    row?.credentialType === 'api_key' || row?.credentialType === 'oauth'
      ? row.credentialType
      : null;

  const hasEnvCred = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  const source: AiKeySource = orgCredentialType ? 'org' : hasEnvCred ? 'env' : 'none';

  return {
    source,
    orgCredentialType,
    keyLast4: orgCredentialType === 'api_key' ? (row?.apiKeyLast4 ?? null) : null,
    subscriptionLast4: orgCredentialType === 'oauth' ? (row?.oauthAccessLast4 ?? null) : null,
    orgModel: row?.model ?? null,
    effectiveModel: row?.model ?? env.OCR_MODEL,
    encryptionAvailable: isSecretEncryptionAvailable(),
  };
}
