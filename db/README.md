# Database migrations (Neon)

ARC runs on **Neon Postgres**. Neon is the source of truth for the schema — **not** Prisma.
Never run `prisma migrate dev` / `prisma db push`. Prisma is used only as the query client
(via `@prisma/adapter-pg` against `DATABASE_URL`); the generated client is introspected from
the live schema.

## Layout

- `db/migrations/0000_baseline_neon.sql` — consolidated baseline of the entire `public` schema
  (tables, views, functions, triggers, constraints, indexes). This is what is currently deployed
  on the Neon `production` branch. It was produced by `pg_dump --schema-only` of the original
  Supabase database with auth-coupled objects stripped (see below).
- New changes go in **new** numbered files: `0001_<description>.sql`, `0002_…`, etc.
  Never edit an applied migration — write a new one on top.
- `supabase/migrations/` (repo root) holds the historical M0–M5 Supabase SQL. It is **superseded**
  by the baseline above and kept only for reference.

## Applying a migration

Use the **unpooled** connection (direct, not the pgBouncer pooler) for DDL:

```bash
# from .env.local
psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/0001_xxx.sql
```

Or apply via the Neon MCP (`run_sql` / `run_sql_transaction`) against the `arc` project
(`holy-dawn-95558450`). For risky changes, branch first with the Neon MCP (`create_branch`),
apply + verify there, then apply to `production`.

## What changed from Supabase (migration notes)

- **Auth**: moved from Supabase Auth to **Neon Auth** (managed Better Auth). Identity lives in the
  managed `neon_auth.*` schema in the same database. `neon_auth.user.id` is a `uuid` that equals
  `public.users.id` (mirrored on first authenticated request — see `src/server/auth/index.ts`).
- **Dropped objects** (depended on Supabase `auth.uid()` / `auth.users`): functions
  `accept_invitation` (×2), `get_invitation_by_hash`, `handle_new_auth_user`, `user_org_ids`,
  `rls_auto_enable`; and all 69 RLS policies. Their logic moved into app code (server actions /
  the auth layer), which is safe because Prisma connects as the table **owner** and bypasses RLS.
- **RLS** stays `ENABLE`d on every table but **policy-less** — armed but dormant. The real tenant
  gate is explicit `organizationId` filtering in every query. Re-introducing live RLS is a
  separate, optional hardening task.
- **Storage**: moved from Supabase Storage to **Vercel Blob** (one private store; see
  `src/lib/blob-paths.ts` + `src/app/api/blob/*`).
