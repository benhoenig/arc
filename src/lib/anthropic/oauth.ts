import 'server-only';

import { env } from '@/lib/env';

/**
 * Claude *subscription* OAuth support — parsing the credential an operator
 * pastes from their local Claude Code login, and refreshing the short-lived
 * access token.
 *
 * The operator gets the credential on macOS with:
 *   security find-generic-password -s "Claude Code-credentials" -w
 *
 * IMPORTANT: the token endpoint + client id mirror what Claude Code uses. They
 * are NOT officially documented by Anthropic for third-party apps, so this is a
 * best-effort integration that could break if Anthropic changes them. Both are
 * env-overridable (ANTHROPIC_OAUTH_TOKEN_URL / ANTHROPIC_OAUTH_CLIENT_ID).
 *
 * Caveat: ARC stores its own copy of the token pair and self-refreshes on
 * expiry. If Anthropic rotates refresh tokens, that refresh can desync your
 * local Claude Code login (Claude Code would re-authenticate on its next use).
 */

const DEFAULT_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const DEFAULT_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

/** Beta header that authorizes inference with a subscription Bearer token. */
export const OAUTH_BETA_HEADER = 'oauth-2025-04-20';

function tokenUrl(): string {
  return env.ANTHROPIC_OAUTH_TOKEN_URL ?? DEFAULT_TOKEN_URL;
}
function clientId(): string {
  return env.ANTHROPIC_OAUTH_CLIENT_ID ?? DEFAULT_CLIENT_ID;
}

export type SubscriptionCredential = {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry, epoch ms. 0 when unknown (forces a refresh on first use). */
  expiresAt: number;
};

/** Distinguishes credential/refresh failures from unexpected runtime errors. */
export class SubscriptionCredentialError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'SubscriptionCredentialError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse the credential blob an operator pastes. Accepts either the full
 * `{ "claudeAiOauth": { ... } }` wrapper Claude Code stores, or the inner object
 * on its own. Throws `SubscriptionCredentialError` on any bad shape.
 */
export function parseSubscriptionCredential(raw: string): SubscriptionCredential {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim());
  } catch {
    throw new SubscriptionCredentialError('not_json');
  }

  const source = isRecord(json) && isRecord(json.claudeAiOauth) ? json.claudeAiOauth : json;
  if (!isRecord(source)) {
    throw new SubscriptionCredentialError('bad_shape');
  }

  const { accessToken, refreshToken, expiresAt } = source;
  if (typeof accessToken !== 'string' || !accessToken.startsWith('sk-ant-oat')) {
    throw new SubscriptionCredentialError('bad_access_token');
  }
  if (typeof refreshToken !== 'string' || !refreshToken.startsWith('sk-ant-ort')) {
    throw new SubscriptionCredentialError('bad_refresh_token');
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : 0,
  };
}

/**
 * Exchange a refresh token for a fresh access token (and a possibly-rotated
 * refresh token). Throws `SubscriptionCredentialError` on any failure.
 */
export async function refreshAccessToken(refreshToken: string): Promise<SubscriptionCredential> {
  // OAuth token endpoints take application/x-www-form-urlencoded (RFC 6749 §4).
  let response: Response;
  try {
    response = await fetch(tokenUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId(),
      }).toString(),
    });
  } catch {
    throw new SubscriptionCredentialError('network');
  }

  if (!response.ok) {
    throw new SubscriptionCredentialError(`status_${response.status}`);
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data) || typeof data.access_token !== 'string') {
    throw new SubscriptionCredentialError('bad_response');
  }

  const nextRefresh = typeof data.refresh_token === 'string' ? data.refresh_token : refreshToken;
  const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;

  return {
    accessToken: data.access_token,
    refreshToken: nextRefresh,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}
