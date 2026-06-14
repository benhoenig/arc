import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

// Resolve a Claude client from whichever credential is configured:
//   1. ANTHROPIC_API_KEY      — usage billed to the API account (x-api-key).
//   2. ANTHROPIC_AUTH_TOKEN   — a Claude *subscription* OAuth token (e.g. from
//      `ant auth login` / Claude Code), sent as a Bearer token with the OAuth
//      beta header. Note: subscription tokens are short-lived and are NOT
//      auto-refreshed from an env var — refresh the value when it expires.
// With neither set, returns null and the caller reports "not configured".
//
// We never set both: passing `apiKey: null` when using the token stops the SDK
// from auto-reading ANTHROPIC_API_KEY from the environment (sending both
// credentials makes the API reject the request).

let cached: Anthropic | null | undefined;

export function getAnthropicClient(): Anthropic | null {
  if (cached !== undefined) {
    return cached;
  }

  if (env.ANTHROPIC_API_KEY) {
    cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  } else if (env.ANTHROPIC_AUTH_TOKEN) {
    cached = new Anthropic({
      apiKey: null,
      authToken: env.ANTHROPIC_AUTH_TOKEN,
      defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
    });
  } else {
    cached = null;
  }

  return cached;
}

export const OCR_MODEL = env.OCR_MODEL;
