import 'server-only';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import { db } from '@/server/db';
import { refreshAccessToken } from './oauth';

/**
 * Return a currently-valid subscription access token for the org, refreshing
 * and persisting a new one when the stored token is at/near expiry. Returns
 * null when the org has no usable subscription credential (no oauth credential,
 * a decrypt failure, or a refresh failure) — callers treat null as "the org's
 * subscription is unavailable" and fall through credential precedence.
 *
 * Refresh writes the rotated token pair back. This is a write on the OCR read
 * path, but OCR runs inside a server action (not render), so the write is legal.
 * Concurrency caveat: two simultaneous OCR calls that both hit expiry will both
 * refresh; with refresh-token rotation one stored pair may briefly go stale.
 * Acceptable for this low-concurrency internal tool — revisit with a lock if
 * extraction ever runs highly parallel.
 */

// Refresh a minute early so a token doesn't expire mid-request.
const EXPIRY_MARGIN_MS = 60_000;

export async function getValidSubscriptionAccessToken(orgId: string): Promise<string | null> {
  const row = await db.orgAiSettings.findUnique({
    where: { organizationId: orgId },
    select: {
      credentialType: true,
      oauthAccessTokenEncrypted: true,
      oauthRefreshTokenEncrypted: true,
      oauthExpiresAt: true,
    },
  });

  if (
    row?.credentialType !== 'oauth' ||
    !row.oauthAccessTokenEncrypted ||
    !row.oauthRefreshTokenEncrypted
  ) {
    return null;
  }

  const stillValid =
    row.oauthExpiresAt !== null && row.oauthExpiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now();

  if (stillValid) {
    try {
      return decryptSecret(row.oauthAccessTokenEncrypted);
    } catch (error) {
      console.error('getValidSubscriptionAccessToken: access-token decrypt failed', error);
      return null;
    }
  }

  // At/near expiry — refresh and persist the rotated pair.
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(row.oauthRefreshTokenEncrypted);
  } catch (error) {
    console.error('getValidSubscriptionAccessToken: refresh-token decrypt failed', error);
    return null;
  }

  try {
    const next = await refreshAccessToken(refreshToken);
    await db.orgAiSettings.update({
      where: { organizationId: orgId },
      data: {
        oauthAccessTokenEncrypted: encryptSecret(next.accessToken),
        oauthRefreshTokenEncrypted: encryptSecret(next.refreshToken),
        oauthAccessLast4: next.accessToken.slice(-4),
        oauthExpiresAt: new Date(next.expiresAt),
      },
    });
    return next.accessToken;
  } catch (error) {
    console.error('getValidSubscriptionAccessToken: refresh failed', error);
    return null;
  }
}
