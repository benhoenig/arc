import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { OAUTH_BETA_HEADER } from '@/lib/anthropic/oauth';
import { getValidSubscriptionAccessToken } from '@/lib/anthropic/oauth-token-store';
import { decryptSecret } from '@/lib/crypto/secret-box';
import { env } from '@/lib/env';
import { db } from '@/server/db';

// Resolve a Claude client + model for a given org. Credential precedence:
//   1. Org API key       — credential_type='api_key', encrypted in
//      org_ai_settings; billed to that org's Anthropic account (x-api-key).
//   2. Org subscription  — credential_type='oauth'; a Claude subscription
//      credential, access token auto-refreshed server-side (Bearer + OAuth
//      beta header). Set via /settings/ai.
//   3. ANTHROPIC_API_KEY env    — shared deploy-time key (x-api-key).
//   4. ANTHROPIC_AUTH_TOKEN env — a Claude subscription OAuth token from the
//      environment (Bearer + OAuth beta header). Short-lived; not refreshed.
// With none of the above, returns null and the caller reports "not configured".
//
// Model precedence: the org's model override (org_ai_settings.model) wins,
// otherwise the OCR_MODEL env default.
//
// We never set both apiKey and authToken — passing `apiKey: null` for a token
// path stops the SDK from auto-reading ANTHROPIC_API_KEY from the environment
// (sending both credentials makes the API reject the request).
//
// NOTE: unlike the previous module-level singleton, this is NOT cached — the
// client is org-specific, and building one is cheap. Caching across orgs would
// leak one org's credential into another's request.

export type OcrClient = {
  client: Anthropic;
  model: string;
};

export async function getOcrClientForOrg(orgId: string): Promise<OcrClient | null> {
  const settings = await db.orgAiSettings.findUnique({
    where: { organizationId: orgId },
    select: { credentialType: true, apiKeyEncrypted: true, model: true },
  });

  const model = settings?.model ?? env.OCR_MODEL;

  // 1. Org-owned API key.
  if (settings?.credentialType === 'api_key' && settings.apiKeyEncrypted) {
    try {
      const apiKey = decryptSecret(settings.apiKeyEncrypted);
      return { client: new Anthropic({ apiKey }), model };
    } catch (error) {
      // A stored key that won't decrypt (e.g. SECRET_ENCRYPTION_KEY rotated)
      // shouldn't silently fall back to the shared key — surface it as "not
      // configured" so the org notices and re-enters their key.
      console.error('getOcrClientForOrg: failed to decrypt org key', error);
      return null;
    }
  }

  // 2. Org subscription (OAuth) — refreshes the access token if needed.
  if (settings?.credentialType === 'oauth') {
    const accessToken = await getValidSubscriptionAccessToken(orgId);
    if (accessToken) {
      return {
        client: new Anthropic({
          apiKey: null,
          authToken: accessToken,
          defaultHeaders: { 'anthropic-beta': OAUTH_BETA_HEADER },
        }),
        model,
      };
    }
    // Configured but unusable (refresh failed) — don't silently fall back to a
    // shared env credential; surface as "not configured" so the org notices.
    return null;
  }

  // 3. Shared env API key.
  if (env.ANTHROPIC_API_KEY) {
    return { client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), model };
  }

  // 4. Subscription OAuth token from the environment.
  if (env.ANTHROPIC_AUTH_TOKEN) {
    return {
      client: new Anthropic({
        apiKey: null,
        authToken: env.ANTHROPIC_AUTH_TOKEN,
        defaultHeaders: { 'anthropic-beta': OAUTH_BETA_HEADER },
      }),
      model,
    };
  }

  return null;
}
