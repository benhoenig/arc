import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Symmetric encryption for org-level secrets at rest (e.g. each org's own
 * Anthropic API key). AES-256-GCM — authenticated encryption, so tampering with
 * the ciphertext is detected on decrypt rather than yielding garbage plaintext.
 *
 * The master key comes from `SECRET_ENCRYPTION_KEY` (base64-encoded 32 bytes).
 * It is OPTIONAL at the env layer so the app still boots without it; callers
 * must handle `isSecretEncryptionAvailable() === false` (the AI-settings UI
 * shows "encryption not configured"). Encrypting/decrypting without it throws.
 *
 * Wire format of `encryptSecret()` output: `iv:authTag:ciphertext`, each part
 * base64. One self-describing string => one DB column, no schema coupling to
 * the IV/tag layout.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the GCM standard

/** Decode + validate the master key once, lazily. Throws if malformed. */
function getMasterKey(): Buffer {
  const raw = env.SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'SECRET_ENCRYPTION_KEY is not set — cannot encrypt or decrypt org secrets. ' +
        'Generate one with `openssl rand -base64 32`.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SECRET_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }
  return key;
}

/** Whether a usable master key is configured. Cheap, never throws. */
export function isSecretEncryptionAvailable(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a UTF-8 plaintext secret. Returns `iv:authTag:ciphertext` (base64). */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  );
}

/** Decrypt a string produced by `encryptSecret`. Throws if malformed/tampered. */
export function decryptSecret(payload: string): string {
  const key = getMasterKey();
  const parts = payload.split(':');
  const [ivB64, tagB64, ctB64] = parts;
  if (parts.length !== 3 || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed encrypted secret — expected `iv:authTag:ciphertext`.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
