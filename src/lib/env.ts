import 'server-only';
import { z } from 'zod';

/*
 * Single source of truth for environment variables.
 * Validated at module load — process crashes with a helpful error if any
 * required var is missing or malformed, rather than failing silently later.
 *
 * Per CONVENTIONS.md §17, NO other file may read process.env directly.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Neon — Postgres + Neon Auth (migration target, replacing Supabase).
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),
  NEON_AUTH_BASE_URL: z.string().url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),

  // Vercel Blob — private store for property thumbnails + receipts.
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  LINE_NOTIFY_CLIENT_ID: z.string().min(1),
  LINE_NOTIFY_CLIENT_SECRET: z.string().min(1),

  TRIGGER_API_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url(),

  // Treat empty string as absent — a blank `SENTRY_DSN=` in .env.local counts
  // as "Sentry disabled" rather than a validation error.
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

  // AI document extraction (M6.7). Either auth method works — the OCR client
  // prefers the API key, then falls back to a Claude subscription OAuth token
  // (e.g. from `ant auth login` / Claude Code). Both optional: with neither
  // set, extraction is simply disabled. Empty strings count as absent.
  ANTHROPIC_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  ANTHROPIC_AUTH_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
  // Token endpoint + client id used to refresh a stored Claude *subscription*
  // credential (org_ai_settings, credential_type='oauth'). These mirror the
  // values Claude Code uses; they are NOT officially documented by Anthropic, so
  // they're overridable here in case Anthropic changes them — no code edit
  // needed. Defaults live in src/lib/anthropic/oauth.ts. Empty string = absent.
  ANTHROPIC_OAUTH_CLIENT_ID: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
  ANTHROPIC_OAUTH_TOKEN_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  // Override the extraction model without a code change. Defaults to Sonnet 4.6.
  OCR_MODEL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).default('claude-sonnet-4-6'),
  ),
  // USD→THB rate used to price AI token usage for display. Snapshotted per
  // usage event, so changing it only affects new events. Override when the rate
  // drifts; default is a reasonable mid-rate. Empty string counts as absent.
  USD_TO_THB_RATE: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().positive().optional(),
  ),

  // Master key for encrypting org-level secrets at rest (e.g. each org's own
  // Anthropic API key in `org_ai_settings`). AES-256-GCM needs 32 bytes — supply
  // a base64-encoded 32-byte value (`openssl rand -base64 32`). Optional: when
  // absent, secret encryption is unavailable and the AI-settings page reports
  // "encryption not configured" instead of crashing the app at boot. Empty
  // string counts as absent. Validated for correct length in `secret-box.ts`.
  SECRET_ENCRYPTION_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '❌ Invalid environment configuration:\n',
    JSON.stringify(parsed.error.format(), null, 2),
  );
  throw new Error('Invalid environment configuration — see log above');
}

export const env = parsed.data;
