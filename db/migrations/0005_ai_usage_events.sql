-- 0005_ai_usage_events.sql
-- Append-only log of AI token usage, one row per model call (today: OCR
-- document extraction). Lets us show each org its Claude usage and the cost in
-- THB on /settings/ai.
--
-- Cost is SNAPSHOTTED per event: we store input/output tokens AND the computed
-- cost_usd / cost_thb / usd_to_thb at write time. So when Anthropic changes
-- prices or the FX rate moves, historical rows keep the cost they actually
-- incurred — only new events use the new numbers. Pricing lives in app code
-- (src/features/ai-usage/lib/pricing.ts).
--
-- `provider` defaults to 'anthropic' and exists so OpenAI usage slots in here
-- unchanged when that provider lands (deferred).
--
-- Note: when an org uses a Claude *subscription* (flat-rate) rather than an API
-- key, cost_thb is the API-EQUIVALENT value, not an actual charge — the UI
-- labels it as such.
--
-- Immutable: no updated_at, no soft-delete. RLS enabled but policy-less, like
-- every other table — the app-level organization_id filter is the tenant gate.

BEGIN;

CREATE TABLE public.ai_usage_events (
    id                 uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id    uuid NOT NULL,
    user_id            uuid,
    provider           text NOT NULL DEFAULT 'anthropic',
    model              text NOT NULL,
    feature            text NOT NULL,
    input_tokens       integer NOT NULL DEFAULT 0,
    output_tokens      integer NOT NULL DEFAULT 0,
    cache_read_tokens  integer NOT NULL DEFAULT 0,
    cache_write_tokens integer NOT NULL DEFAULT 0,
    cost_usd           numeric(14, 6) NOT NULL DEFAULT 0,
    cost_thb           numeric(14, 4) NOT NULL DEFAULT 0,
    usd_to_thb         numeric(10, 4) NOT NULL,
    created_at         timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id),
    CONSTRAINT chk_ai_usage_tokens_nonneg CHECK (
        input_tokens >= 0 AND output_tokens >= 0
        AND cache_read_tokens >= 0 AND cache_write_tokens >= 0
    )
);

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id);

CREATE INDEX idx_ai_usage_org_created ON public.ai_usage_events
    USING btree (organization_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

COMMIT;
