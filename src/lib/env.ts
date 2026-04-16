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

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().url(),
  SUPABASE_DB_URL_POOLED: z.string().url(),

  LINE_NOTIFY_CLIENT_ID: z.string().min(1),
  LINE_NOTIFY_CLIENT_SECRET: z.string().min(1),

  TRIGGER_API_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url(),

  SENTRY_DSN: z.string().url().optional(),
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
