import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates a pair of (rawToken, tokenHash) for a new invitation.
 *  - `rawToken` is URL-safe base64, 32 bytes of entropy (256 bits). Only
 *    this form ever leaves the server (in the invite link shown to admin).
 *  - `tokenHash` is the SHA-256 of the raw token, stored in the DB. Even
 *    if the DB is leaked, stored hashes can't be replayed as valid links.
 */
export function generateInviteToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url');
  return { rawToken, tokenHash: hashInviteToken(rawToken) };
}

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
