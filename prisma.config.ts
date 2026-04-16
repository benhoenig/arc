import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

/*
 * Load .env.local (Next.js convention) for Prisma CLI invocations.
 * Our src/lib/env.ts still owns runtime env validation per CONVENTIONS.md §17;
 * this file is CLI-time only (migrate, db pull, generate) — it is not imported
 * by any app runtime code.
 *
 * Prisma 7 moved connection URLs from schema.prisma's datasource block to
 * this file. CLI operations (migrate, db pull) use the direct URL; runtime
 * queries use the pooler via a driver adapter in src/server/db.ts (M1).
 */
config({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Free-tier Supabase disables IPv4 on the direct (port 5432) URL, so CLI
    // operations use the Supavisor pooler (port 6543). Upgrade to Pro and the
    // IPv4 add-on to use SUPABASE_DB_URL directly for faster migrations.
    url: process.env.SUPABASE_DB_URL_POOLED,
  },
});
