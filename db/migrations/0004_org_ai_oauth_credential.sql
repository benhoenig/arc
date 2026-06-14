-- 0004_org_ai_oauth_credential.sql
-- Extend per-org AI settings to support a Claude *subscription* credential
-- (OAuth) as an alternative to an Anthropic API key. An org now uses exactly
-- ONE credential, chosen by `credential_type`:
--   'api_key' -> api_key_encrypted               (x-api-key, billed to that key)
--   'oauth'   -> oauth_access/refresh_token_*     (Bearer + oauth beta header)
--
-- Why store the refresh token too: subscription access tokens are short-lived
-- (~1h). We persist the refresh token (encrypted) and mint a fresh access token
-- server-side on expiry (src/lib/anthropic/oauth-token-store.ts) so the operator
-- pastes the credential once instead of re-pasting hourly.
--
-- Security: every token is stored ENCRYPTED at rest (AES-256-GCM, app-level via
-- src/lib/crypto/secret-box.ts). `oauth_access_last4` is the last 4 plaintext
-- chars of the access token, purely for a masked display hint — no plaintext
-- token ever leaves the server or is returned to the client.
--
-- Runtime precedence (see src/features/ocr/lib/anthropic.ts):
--   org api_key  ->  org subscription  ->  env ANTHROPIC_API_KEY
--     ->  env ANTHROPIC_AUTH_TOKEN  ->  none
--
-- This migration is purely additive: nullable columns + new CHECK constraints
-- that every existing row already satisfies, plus a one-time backfill that sets
-- credential_type='api_key' for any org that already stored an API key (so the
-- new discriminator-driven precedence keeps using their existing key).

BEGIN;

ALTER TABLE public.org_ai_settings
    ADD COLUMN credential_type               text,
    ADD COLUMN oauth_access_token_encrypted  text,
    ADD COLUMN oauth_refresh_token_encrypted text,
    ADD COLUMN oauth_access_last4            text,
    ADD COLUMN oauth_expires_at              timestamp with time zone;

-- Which credential the org actively uses.
ALTER TABLE public.org_ai_settings
    ADD CONSTRAINT chk_ai_credential_type CHECK (
        credential_type IS NULL OR credential_type IN ('api_key', 'oauth')
    );

-- last4 only makes sense alongside a stored access token; keep them consistent.
ALTER TABLE public.org_ai_settings
    ADD CONSTRAINT chk_ai_oauth_last4 CHECK (
        (oauth_access_token_encrypted IS NULL AND oauth_access_last4 IS NULL)
        OR (oauth_access_token_encrypted IS NOT NULL AND oauth_access_last4 IS NOT NULL)
    );

-- The active credential's fields must actually be present.
ALTER TABLE public.org_ai_settings
    ADD CONSTRAINT chk_ai_credential_consistency CHECK (
        credential_type IS NULL
        OR (credential_type = 'api_key' AND api_key_encrypted IS NOT NULL)
        OR (credential_type = 'oauth'
            AND oauth_access_token_encrypted  IS NOT NULL
            AND oauth_refresh_token_encrypted IS NOT NULL
            AND oauth_expires_at              IS NOT NULL)
    );

-- Backfill: an org that stored an API key before this migration has no
-- credential_type yet — make the discriminator match its existing data so
-- precedence still finds the key.
UPDATE public.org_ai_settings
   SET credential_type = 'api_key'
 WHERE api_key_encrypted IS NOT NULL
   AND credential_type IS NULL;

COMMIT;
