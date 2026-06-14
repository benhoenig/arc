-- 0003_org_ai_settings.sql
-- Per-org AI provider settings — each organization may store its own Anthropic
-- API key (for the M6.7 document-extraction feature) instead of relying on the
-- deploy-time ANTHROPIC_API_KEY env var.
--
-- Security: the API key is a secret. It is stored ENCRYPTED at rest
-- (AES-256-GCM, app-level via src/lib/crypto/secret-box.ts) in
-- `api_key_encrypted` as `iv:authTag:ciphertext` (base64). `api_key_last4` holds
-- the last 4 plaintext chars purely for a masked display hint, so the UI never
-- has to decrypt just to render "sk-...AB12". The plaintext key never leaves the
-- server and is never returned to the client.
--
-- Runtime precedence (see src/features/ocr/lib/anthropic.ts):
--   org api_key  ->  env ANTHROPIC_API_KEY  ->  env ANTHROPIC_AUTH_TOKEN  ->  none
--
-- One row per org (UNIQUE organization_id). RLS enabled but policy-less, matching
-- every other table — the app-level organization_id filter is the tenant gate.

BEGIN;

CREATE TABLE public.org_ai_settings (
    id                uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id   uuid NOT NULL,
    api_key_encrypted text,
    api_key_last4     text,
    model             text,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL,
    created_by        uuid,
    updated_by        uuid,
    CONSTRAINT org_ai_settings_pkey PRIMARY KEY (id),
    -- last4 only makes sense alongside a stored key; keep them consistent.
    CONSTRAINT chk_ai_settings_last4 CHECK (
        (api_key_encrypted IS NULL AND api_key_last4 IS NULL)
        OR (api_key_encrypted IS NOT NULL AND api_key_last4 IS NOT NULL)
    )
);

ALTER TABLE ONLY public.org_ai_settings
    ADD CONSTRAINT org_ai_settings_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_ai_settings
    ADD CONSTRAINT org_ai_settings_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.org_ai_settings
    ADD CONSTRAINT org_ai_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id);

-- One settings row per org.
CREATE UNIQUE INDEX uq_org_ai_settings_org ON public.org_ai_settings
    USING btree (organization_id);

ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_ai_settings_updated_at BEFORE UPDATE
    ON public.org_ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
