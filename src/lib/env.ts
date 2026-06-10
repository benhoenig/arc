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
