# TECH_STACK.md

## Property Flipping Management System — Technology Stack
### The full technology inventory. Every tool, every version, every reason.

> **Reading this doc:** This doc is the single source of truth for *what* tools we use. Design patterns live in CONVENTIONS.md, visual language in DESIGN_SYSTEM.md, data in DATA_MODEL.md, product scope in PRODUCT_SPEC.md. Here we only cover the tech inventory, versions, and rationale.

---

## 1. Stack summary

| Layer | Choice | Version (pinned) |
|---|---|---|
| Runtime | Node.js | 22.x LTS |
| Package manager | pnpm | 9.x |
| Language | TypeScript | 5.6.x |
| Framework | Next.js | 15.x (App Router) |
| UI library | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| Component library | shadcn/ui | latest (copy-paste, not versioned) |
| Icons | Lucide React | 0.460+ |
| Database | Supabase (Postgres 15) | managed |
| ORM | Prisma | 6.x |
| Auth | Supabase Auth | managed |
| File storage | Supabase Storage | managed |
| i18n | next-intl | 3.x |
| Forms | react-hook-form | 7.53+ |
| Form validation | zod | 3.23+ |
| Tables | @tanstack/react-table | 8.x |
| Date handling | date-fns | 4.x |
| Notifications (runtime) | sonner | 1.5+ |
| Notifications (users) | LINE Notify (v1), Resend (v2) | — |
| Background jobs | Trigger.dev | 3.x |
| Maps (deferred) | Mapbox GL JS | 3.x |
| Linter + formatter | Biome | 1.9+ |
| Git hooks | lefthook | 1.7+ |
| Testing | Vitest + Playwright | latest |
| Hosting (frontend) | Vercel | managed |
| Hosting (database) | Supabase Cloud (Singapore) | managed |
| CI | GitHub Actions | managed |

Everything here is a hard dependency unless marked "deferred" or "v2."

---

## 2. Runtime & Language

### 2.1 Node.js 22 LTS

Current LTS line. Node 20 enters end-of-life April 2026; Node 22 is the active LTS through April 2027. LTS-only — no current / experimental versions.

**Why:** Supabase Edge Functions run on Deno, but the app runtime is Node via Vercel. Node 22 is supported by Next.js 15 and includes the modern ECMAScript features we rely on (native `fetch`, Web Streams, Intl.Segmenter for Thai text) plus native WebSocket client and improved Promise performance over Node 20.

**Locked via:**
- `package.json` → `"engines": { "node": "22.x" }`
- `.nvmrc` → `22`
- Vercel runtime pinned to Node 22

### 2.2 pnpm 9

**Why pnpm over npm/yarn:**
- ~2× faster installs via content-addressable store
- Strict dependency resolution (no phantom dependencies — npm/yarn both allow accidental access to transitive deps)
- Better monorepo support if ECHO + Flipping ever merge into a workspace
- Smaller disk footprint (shared store across projects)

**Locked via:**
- `package.json` → `"packageManager": "pnpm@9.12.0"`
- CI fails on `npm install` / `yarn install`
- Corepack enabled in dev setup

### 2.3 TypeScript 5.6

Strict mode, `noUncheckedIndexedAccess`, `noImplicitOverride`, and all other strictness flags enabled. See CONVENTIONS.md Section 4.

**Why the latest minor:** `satisfies` operator, improved control flow analysis for narrowing, better editor performance. TypeScript moves fast; staying current is cheaper than catching up.

---

## 3. Frontend framework

### 3.1 Next.js 15 (App Router)

**Why Next.js and not a SPA + separate API:**
- Server Components = less client JavaScript = faster mobile performance (our users are on 4G in Thailand)
- Server Actions = typesafe writes without an API layer
- Built-in SEO via metadata API (listings page will be crawled by buyers via search)
- Vercel deployment is plug-and-play
- Matches ECHO stack — team familiarity

**Why the App Router, not Pages Router:**
- Server Components are the whole point
- Layouts + streaming + suspense work correctly
- Pages Router is in maintenance mode — not adding features

**Critical gotchas baked into conventions:**
- Dynamic rendering for anything user-scoped (auth, org-scoped data)
- `revalidatePath` / `revalidateTag` after every mutation
- Locale via `[locale]` dynamic segment (see Section 7)
- No `getServerSideProps` — doesn't exist in App Router

### 3.2 React 19

Latest stable. Required by Next.js 15.

**What we use:**
- Server Components (default)
- Client Components (`"use client"` only when needed)
- `useTransition` for pending states on server actions
- `use()` for reading promises and context in Server Components

**What we don't use:**
- `useContext` for app-wide state (RSC + props covers it)
- Third-party state libraries (banned — CONVENTIONS.md §17)
- Class components (banned)

---

## 4. Styling & UI

### 4.1 Tailwind CSS 4

**Why:**
- Design tokens (colors, spacing, typography) map directly to Tailwind theme
- No CSS files to maintain; every style lives with its component
- Tailwind v4 is faster and smaller than v3 (Lightning CSS engine)
- Dark mode support via CSS variables (matches our DESIGN_SYSTEM.md token approach)

**Configuration:**
- All design tokens from DESIGN_SYSTEM.md §2–4 defined in `tailwind.config.ts`
- No default palette — we override `colors` entirely to prevent `text-blue-500`-style violations
- Arbitrary values disabled via Biome lint rule (see CONVENTIONS.md §12.2)

### 4.2 shadcn/ui

**Why:**
- Copy-paste components, not a versioned library — we own the code, customize freely
- Built on Radix UI primitives (accessibility handled correctly)
- Matches shadcn's visual language, which is monochrome-first (aligns with DESIGN_SYSTEM.md)
- No bundle cost for components we don't use

**Installation:**
- `npx shadcn@latest init` at project setup
- Each component installed individually: `npx shadcn@latest add button input table dialog ...`
- Customization: every component is edited to match our tokens before first use (see CONVENTIONS.md §13 caveat re: Tailwind classes)

**Components installed in v1:**
`button`, `input`, `label`, `form`, `table`, `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `command`, `tabs`, `select`, `checkbox`, `radio-group`, `sheet`, `skeleton`, `tooltip`, `separator`, `avatar`.

Not installed unless needed: `accordion`, `carousel`, `calendar` (we'll use a custom date picker), `progress` (we build our own for budget bars).

### 4.3 Lucide React

**Why:**
- Consistent visual style with the design system
- Tree-shakeable — only imported icons ship
- 1.5 stroke-width customization works (CONVENTIONS.md §6 default)
- Matches ECHO

**Rule:** Always import from `lucide-react`, never copy-paste SVG icons inline. Wrap in a central re-export (`/src/components/icons/index.ts`) if you need to enforce stroke-width consistently — though `Icon` components accept `strokeWidth` as a prop directly.

### 4.4 Typography — IBM Plex Sans Thai + IBM Plex Mono

Loaded via `next/font/google` (see DESIGN_SYSTEM.md §3.2). Zero runtime CSS flash — fonts are inlined at build time.

**Why these fonts:**
- Mixed Thai + Latin rendering in a single face
- Real weights (300, 400, 500, 600, 700) — no synthetic bold
- Matching x-heights across scripts
- Free, open-licensed, already used in ECHO (visual consistency if apps are ever a suite)

---

## 5. Database & Backend

### 5.1 Supabase (Postgres 15, managed)

**Region:** Singapore (`ap-southeast-1`) — closest to Bangkok for latency.

**Why Supabase over self-hosted Postgres:**
- Auth, Storage, Row-Level Security, Realtime all built-in — no stitching 5 services
- RLS is the multi-tenant security boundary (DATA_MODEL.md §15) — non-negotiable for our commercial-path-B plan
- Managed Postgres with sane defaults (PITR backups, connection pooling, monitoring)
- Same stack as ECHO — tooling and knowledge transfer

**Why Postgres over other DBs:**
- `pgvector` for future AI embedding features (v2)
- JSONB escape hatches for `metadata` columns
- Mature, boring, predictable — exactly what you want under a financial system
- `daterange` and `tstzrange` types for contractor conflict detection (DATA_MODEL.md §18.3)

**Extensions enabled:**
- `pgcrypto` (for `gen_random_uuid()`)
- `earthdistance` + `cube` (for property geo-proximity queries)
- `pg_trgm` (for fuzzy search on property/contractor names in v1.5)
- `pgvector` (for AI embeddings — v2 only)

### 5.2 Prisma 6

ORM + client generation. See CONVENTIONS.md §5 for the full set of patterns.

**Why Prisma:**
- Best-in-class TypeScript types for query results
- Prisma Client is tree-shakeable
- Decent Supabase RLS support (via passing auth context to queries)

**What Prisma isn't good at:**
- Expressing RLS policies (we write these in raw SQL)
- Expressing triggers (same)
- Expressing views (same)
- → Hence the "Supabase migrations are source of truth, Prisma pulls from DB" rule (CONVENTIONS.md §5.2)

**Known limitations we accept:**
- Raw SQL for complex queries (use `db.$queryRaw` with tagged templates for safety)
- No polymorphic relations — we implement these via `entity_type` + `entity_id` columns with app-layer validation (DATA_MODEL.md §10.1, §10.2)

### 5.3 Supabase Auth

**What we use:**
- Email + password (v1 — Thai users generally expect this)
- Magic link (v1 — for password-recovery-avoidance)
- LINE login (v2 — if commercial adoption signals demand)
- Google login (v2)

**What we don't use:**
- Phone auth (cost + SMS reliability issues in Thailand)
- SSO / SAML (irrelevant until enterprise v2)
- MFA (v1.5 — nice-to-have, not critical)

**Session management:**
- JWTs in HTTP-only cookies
- Middleware in `middleware.ts` checks session on every request
- Refresh happens transparently via Supabase SSR helpers

### 5.4 Supabase Storage

**Why:**
- Org-scoped paths natively supported via RLS on storage policies
- CDN-backed delivery (Cloudflare R2 under the hood)
- Direct upload from client (no server bottleneck for photo uploads)
- Same auth context as DB queries

**Buckets:**
- `documents` — user-uploaded files (photos, contracts, receipts, etc.)
  - Path pattern: `organizations/{org_id}/{entity_type}/{entity_id}/{timestamp}-{filename}`
  - RLS policy: user must be a member of the org to read/write
  - Max file size: 20MB (enforced in bucket config)
  - Allowed MIME types: images (jpeg, png, webp, heic), PDFs, docs (docx, xlsx)

**Client-side compression before upload:**
- Photos → resize to max 2048px on long edge + JPEG quality 0.85 → target <500KB per photo
- Done via `browser-image-compression` library before calling `supabase.storage.upload`

---

## 6. Form & validation

### 6.1 react-hook-form 7

See CONVENTIONS.md §9 for the full pattern.

**Why:**
- Minimal re-renders — forms with 30+ fields stay responsive
- Native HTML form semantics (uncontrolled by default)
- First-class async validation
- Integrates cleanly with zod via `@hookform/resolvers/zod`

### 6.2 zod 3

**Why:**
- Same schema validates client input and server input (CONVENTIONS.md §9.3)
- TypeScript types inferred from schemas — never written twice
- Discriminated unions supported (important for our payment_model and terms_model discriminators)
- Async validation via `refine()` for server-only checks

**Upgrade path:** zod 4 is in beta as of this writing. Stay on zod 3 through v1; re-evaluate for v2.

---

## 7. Internationalization

### 7.1 next-intl 3

See DESIGN_SYSTEM.md §8 and CONVENTIONS.md §13 for full usage patterns.

**Why next-intl over alternatives:**
- Server Component support (most i18n libs still client-only or require workarounds)
- ICU message format (plural, select, date, number formatting)
- Locale-aware routing via middleware
- TypeScript types generated from message files
- Better DX than `react-intl` or `i18next` for App Router projects

**Locale setup:**
- Default: `th`
- Supported: `th`, `en`
- URL pattern: `/` (Thai), `/en/*` (English)
- Resolution: user preference → cookie → `Accept-Language` → default

### 7.2 date-fns 4

**Why date-fns over Day.js or Luxon:**
- Tree-shakeable — only imported functions ship
- Thai locale support built-in (`date-fns/locale/th`)
- Immutable API (no `moment`-style mutation bugs)
- date-fns 4 has native Intl integration for better formatting

**What we use it for:**
- "X days ago" relative formatting in Client Components (`formatDistanceToNow`)
- Date arithmetic that Postgres doesn't need to do
- Buddhist Era conversion helpers live in `/src/lib/formatters/date.ts` (CONVENTIONS.md §13.5) — we don't use any library for BE conversion, just math (`year + 543`)

---

## 8. Tables & data display

### 8.1 @tanstack/react-table 8

See CONVENTIONS.md §10 for the standard pattern.

**Why:**
- Headless — we control all rendering via shadcn `Table` primitives
- Handles sorting, filtering, pagination, row selection without opinion
- First-class TypeScript support with column types derived from row types
- Server-side pagination supported (needed once tables get large)

**What we don't use:**
- `@tanstack/react-virtual` (v1) — our tables max out around 200 rows; virtualization is v2 if it becomes an issue
- Export-to-CSV features (v2; use a Server Action if needed)

---

## 9. Notifications

### 9.1 sonner (runtime toasts)

**Why:**
- Plays nicely with shadcn (it's their recommended toast lib)
- Minimal API, good accessibility defaults
- Supports variants we need (default, success, error) — though we style them to match DESIGN_SYSTEM.md §5.7

### 9.2 LINE Notify (user notifications, v1)

**Why this over email in v1:**
- Thai team uses LINE for everything — email open rates are abysmal
- LINE Notify is free, API is simple, deliverability is near-instant

**Architecture:**
- `notifications` table is the queue (DATA_MODEL.md §11.2)
- A Trigger.dev task (`process-notification-queue`) runs every 60 seconds, picks up `status = 'pending'` rows, sends via LINE Notify API, updates status
- Retries: 3 attempts with exponential backoff before marking `failed`

**Rate limits:**
- LINE Notify: 1000 messages/hour per token — more than enough for our team
- Future commercial scale will hit this; v2 migrates to LINE Messaging API (higher limits, richer content)

### 9.3 Resend (v2, deferred)

For commercial v2 when email becomes necessary (investor statements, buyer lead auto-responders to external emails).

Not installed in v1. Adding it is additive — no refactor required because `channel` on `notifications` is already an enum supporting `'email'`.

---

## 10. Background jobs

### 10.1 Trigger.dev 3

**Why:**
- Next.js-native integration (no server to run separately)
- Durable task execution (survives restarts)
- TypeScript-first, defined in code alongside the rest of the app
- Free tier generous enough for v1 volumes

**Tasks defined in v1:**
- `process-notification-queue` — every 60s, dispatches queued LINE notifications
- `generate-investor-statement-pdf` — on-demand, triggered from UI
- `recalculate-contractor-performance-metrics` — nightly at 2am Bangkok time, updates `contractors.avg_on_time_pct` etc.
- `check-budget-variance-alerts` — hourly during business hours, creates notifications for newly-over-budget flips
- `expire-stale-leads` — nightly, marks leads as `closed_lost` after 60 days of no activity (with notification to sales team)

**Why not:**
- Vercel Cron (limited to 1/day on free tier, no retries, no observability)
- Inngest (more featured but more complex than we need in v1)
- pg_cron (Supabase supports it, but code lives in SQL which is harder to version-control alongside app logic)

---

## 11. Mapping (deferred)

### 11.1 Mapbox GL JS 3

**When we'll add it:** When the product needs a property map view (sourcing pipeline geographic visualization, or a public listing map). Not required for v1 — plain address lists work.

**Why Mapbox over Google Maps:**
- 50,000 free map loads/month (Google: ~28,000 before billing kicks in)
- Per-load pricing after free tier is cheaper for our expected volume
- Styling customization is deeper (important for strict-monochrome map style)
- Lat/long already in `properties` table (DATA_MODEL.md §3.1) — no schema change needed to enable

**Note:** Mapbox GL JS is added to `package.json` when first feature needs it, not preemptively.

---

## 12. Developer tooling

### 12.1 Biome 1.9+

Replaces both ESLint and Prettier. See CONVENTIONS.md §16 for the full config.

**Why:**
- 10× faster than ESLint + Prettier on any reasonable-sized codebase
- Zero config drift (one tool, one config file)
- Rust-based — no weird Node version bugs
- Good-enough rule coverage for 95% of what ESLint gives

**Known gaps:**
- No React-specific lint rules as deep as `eslint-plugin-react-hooks` — but the core `useExhaustiveDependencies` rule is covered
- If a team member hits a specific ESLint rule they miss, we revisit

### 12.2 lefthook 1.7+

**Why lefthook over Husky:**
- Faster (parallel hook execution)
- Single YAML config instead of shell scripts
- Better Windows compatibility (not relevant for your team, but good for OSS-readiness)

**Pre-commit hooks:**
- `biome check --apply` — auto-fix formatting and safe lint issues
- `tsc --noEmit` — type-check everything
- Staged files only (via `lefthook`'s `{staged_files}` variable) — fast even on large diffs

**Pre-push hooks:**
- `pnpm test` — run unit tests
- Does NOT run Playwright (too slow for pre-push; runs in CI instead)

### 12.3 Testing: Vitest + Playwright

**Vitest:**
- Faster than Jest (ESM-native, Vite-powered)
- Compatible with Jest's API — minimal learning curve
- Built-in support for TypeScript, coverage, watch mode

**Playwright:**
- Better browser coverage than Cypress
- Parallel test execution by default
- Network request mocking without opening a can of worms

**Scope:** See CONVENTIONS.md §15. V1 tests the hard stuff (validators, business logic, critical E2E flows), not every component.

---

## 13. Hosting & deployment

### 13.1 Vercel (frontend + edge)

**Why Vercel:**
- Owns Next.js — best possible Next.js support
- Singapore edge region available (low latency for Bangkok)
- Serverless functions auto-scale
- Preview deployments per PR (or per branch)
- Free tier workable for v1; Pro tier (~$20/mo) when we hit limits

**Configuration:**
- Region: `sin1` (Singapore)
- Node version: 20.x
- Build command: `pnpm build`
- Environment variables managed via Vercel dashboard, pulled locally via `vercel env pull`

### 13.2 Supabase Cloud (Singapore)

**Tier:** Pro ($25/mo) — required for daily backups and 8GB database.

**Configuration:**
- Region: `ap-southeast-1` (Singapore)
- Database: Postgres 15
- Connection pooling: Supavisor (transaction mode for short queries, session mode for long-running)
- PITR backups: 7-day window on Pro tier

### 13.3 CI: GitHub Actions

**Workflows:**
- `ci.yml` — runs on every PR: `tsc`, `biome`, `vitest`, Playwright smoke tests
- `deploy-preview.yml` — Vercel handles preview deploys automatically (no GH Action needed)
- `migrate.yml` — on merge to `main`, runs `supabase db push` to apply new migrations to production

---

## 14. Environment variables

Centralized, typed, validated via zod at boot. See CONVENTIONS.md §17 (hard ban on `process.env` access outside `/src/lib/env.ts`).

**Required in v1:**

```bash
# Next.js / Auth
NEXT_PUBLIC_APP_URL                   # e.g., https://flips.yourdomain.com
NEXTAUTH_URL                          # same as above

# Supabase (both client and server)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY             # server-only, never exposed to client
SUPABASE_DB_URL                       # for Prisma connection (direct, not pooled)
SUPABASE_DB_URL_POOLED                # for runtime queries (Supavisor transaction mode)

# LINE Notify
LINE_NOTIFY_CLIENT_ID
LINE_NOTIFY_CLIENT_SECRET

# Trigger.dev
TRIGGER_API_KEY
TRIGGER_API_URL

# Observability (v1.5+)
SENTRY_DSN                            # optional in v1
```

**Validation at boot:**

```ts
// src/lib/env.ts
import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
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

export const env = envSchema.parse(process.env);
```

**If validation fails:** app doesn't start. Fails loud at boot, not silently at query time.

---

## 15. Version upgrade policy

How and when we upgrade dependencies.

### 15.1 Automatic updates

- **Patch versions** (e.g., `15.0.1` → `15.0.2`) — Dependabot auto-merges if CI passes
- **Minor versions of non-critical deps** (e.g., `date-fns 4.1` → `4.2`) — Dependabot proposes, reviewed weekly

### 15.2 Manual updates

- **Major versions of any dep** — reviewed individually, tested in a branch, migrated deliberately
- **Next.js / React / TypeScript** — upgraded together when new minor/major releases stabilize (wait 2-3 weeks after release for ecosystem to catch up)
- **Prisma** — upgrade only when there's a specific reason (new feature needed, critical bug fix); Prisma upgrades occasionally break generated types

### 15.3 The "why not latest" rule

We do NOT always upgrade to the latest. We upgrade when:
- A security vulnerability is patched
- A bug we've hit is fixed
- A feature we need is added
- The ecosystem has caught up (after ~1 month of a major release)

Chasing latest for its own sake is how small teams burn weekends on CI fires.

---

## 16. What's not in the stack (and why)

Explicit non-choices. If Claude Code suggests adding any of these, push back.

| Not used | Reason |
|---|---|
| Redux / Zustand / Jotai / MobX | Server-first architecture (RSC + Server Actions) covers our state needs. See CONVENTIONS.md §17 #15. |
| SWR / React Query for initial fetches | RSC is the right primitive for initial data. React Query is permitted only for polling/optimistic updates (CONVENTIONS.md §8.4). |
| tRPC | Server Actions give us typesafe RPC natively. tRPC adds a layer we don't need. |
| GraphQL | Same reason as tRPC + higher complexity. |
| Storybook | V1 UI iteration is fast enough that Storybook overhead outweighs benefit. Revisit at v2 when component library stabilizes. |
| Lerna / Turborepo | Single app, no monorepo. If ECHO + Flipping merge later, revisit. |
| Docker for local dev | Supabase CLI runs a local Supabase via Docker under the hood — that's as much container as we need. No custom Dockerfile. |
| Redis | Supabase covers caching needs (Postgres materialized views, `upstash-redis` available if ever needed). No Redis in v1. |
| Kubernetes / Docker Swarm | Not deploying to a VM. Vercel + Supabase managed. |
| Microservices | One Next.js app. Will stay one Next.js app through v2. |
| AWS / GCP directly | Vercel + Supabase abstract this. If we ever hit their pricing walls, revisit. |
| jQuery / Lodash / Moment | Native JS covers everything we need. Lodash types aren't worth the bundle. date-fns replaces Moment. |
| Custom webpack config | Next.js owns bundling. Don't touch it. |

---

## 17. Cost estimates (v1 baseline)

Monthly cost at v1 volumes (internal tool, 4 users, 10+ flips, ~10GB storage):

| Service | Tier | Cost (USD) |
|---|---|---|
| Vercel | Pro (required for team features, cron) | ~$20 |
| Supabase | Pro (required for daily backups, 8GB DB) | ~$25 |
| Trigger.dev | Free tier (covers v1 task volume) | $0 |
| LINE Notify | Free | $0 |
| Cloudflare (if CDN for public listings) | Free | $0 |
| Sentry (v1.5+) | Free tier (5K errors/mo) | $0 |
| Domain + DNS | — | ~$1 |
| **Total v1** | | **~$46/mo** |

**At commercial v2 (100 paying orgs):**

| Service | Expected cost |
|---|---|
| Vercel | $100–300 (scales with traffic) |
| Supabase | $100–500 (scales with storage + connections) |
| Resend (emails) | $20–50 |
| Trigger.dev | $50+ |
| Sentry | $26+ (Team tier) |
| **Total v2** | **~$300–1000/mo at 100 orgs** |

That's <$10/org/mo in infrastructure cost, which is a healthy margin against any of your one-time pricing tiers.

---

## 18. Known technical risks & mitigations

Things that could go wrong, and how we've designed around them.

### 18.1 Supabase Connection Pool Exhaustion

**Risk:** Default Postgres connection limit is low. Serverless functions can exhaust it quickly.

**Mitigation:**
- All runtime queries use the Supavisor pooled connection (`SUPABASE_DB_URL_POOLED`, transaction mode)
- Direct connection (`SUPABASE_DB_URL`) used only for migrations
- Prisma's singleton pattern prevents connection leaks (CONVENTIONS.md §5.3)

### 18.2 RLS Policy Mistakes

**Risk:** A bad RLS policy silently exposes cross-tenant data.

**Mitigation:**
- All RLS policies centralized in one migration file (DATA_MODEL.md §16)
- App-layer also filters by `organizationId` (defense-in-depth, CONVENTIONS.md §5.5)
- Playwright tests include a "cross-tenant leak test" — logs in as a user in org A, attempts to read data from org B via direct URL manipulation, asserts 404

### 18.3 Next.js 15 + React 19 Early-Adopter Bugs

**Risk:** We're on recent versions; ecosystem may have gaps.

**Mitigation:**
- Versions pinned exactly, not with `^` or `~`
- Known issue tracker in `/docs/KNOWN_ISSUES.md` (v1.5 doc)
- Willingness to downgrade to Next.js 14 if we hit a blocker (would be a 1-day migration)

### 18.4 Prisma + Supabase Row-Level Security

**Risk:** Prisma doesn't pass auth context to Postgres automatically — RLS won't activate unless set up correctly.

**Mitigation:**
- Use `postgres-js` under the hood (Prisma's default driver) via `DIRECT_URL` for migrations, and set session variables via `SET` before queries
- OR: continue to use the Supabase client for auth-aware queries, Prisma only for migrations and admin tasks (our v1 choice)
- OR: explicitly pass `auth.uid()` via `setConfig` before each Prisma query (more manual but more flexible)

**Current approach:** Use Prisma for writes (where we've already validated `organizationId` in app), use Supabase client for reads in RLS-critical paths. Revisit based on measured performance.

### 18.5 Thai Text Rendering & Search

**Risk:** Postgres `LIKE`/`ILIKE` don't handle Thai correctly (no word boundaries); full-text search without `pg_trgm` is weak.

**Mitigation:**
- `pg_trgm` extension enabled for fuzzy matching
- For v1, search is limited to exact prefix matches on codes, IDs, and nicknames
- Real Thai full-text search deferred to v2 (requires proper tokenization via `thaipg` or migration to a search service like Typesense)

---

## 19. Decisions captured here (for the record)

| # | Decision | Rationale |
|---|---|---|
| 1 | Node 20 LTS, pinned via engines | Predictable runtime, matches Vercel + Next.js 15 |
| 2 | pnpm over npm/yarn | 2× faster, strict deps, shared store |
| 3 | Next.js 15 App Router, not Pages Router | Server Components, streaming, modern primitives |
| 4 | Tailwind v4, no default palette | All colors are design tokens; no stray Tailwind colors |
| 5 | shadcn/ui copy-paste, not a library | We own the code; customize freely to match tokens |
| 6 | Supabase over self-hosted + Auth0 + S3 | One managed stack; RLS is the tenant boundary |
| 7 | Singapore region for both Vercel and Supabase | Lowest latency to Bangkok users |
| 8 | Prisma for queries, raw SQL for schema/RLS | Prisma can't express RLS, triggers, views |
| 9 | Biome, not ESLint + Prettier | 10× faster, one tool, zero config drift |
| 10 | LINE Notify for v1, Resend deferred to v2 | Thai team uses LINE; email is v2 |
| 11 | Trigger.dev over Vercel Cron | Retries, observability, durable execution |
| 12 | Mapbox deferred, not adopted preemptively | YAGNI; plain address lists work for v1 |
| 13 | Vitest + Playwright, minimal v1 test scope | Test the hard stuff; trust the framework |
| 14 | No global state libraries | RSC + Server Actions + react-hook-form covers 99% |
| 15 | Env vars centralized in `/src/lib/env.ts`, zod-validated | Fail-loud at boot, not silent at query time |
| 16 | Pinned versions, not `^` / `~` | Predictable builds; upgrade deliberately |
| 17 | ~$46/mo infrastructure cost in v1 | Cheap enough to not worry about; scales linearly to v2 |

---

## 20. Bootstrap checklist

When setting up this project from zero, this is the order:

1. `pnpm create next-app@latest flipping-system --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Pin Node to 20 (`.nvmrc`), set `packageManager` field in `package.json`
3. `pnpm add -D @biomejs/biome lefthook vitest @playwright/test`
4. `pnpm dlx @biomejs/biome init` → paste our config from CONVENTIONS.md §16
5. `pnpm dlx shadcn@latest init` → accept our token-aware config
6. Install shadcn components listed in §4.2
7. `pnpm add -D prisma && pnpm prisma init` → point at Supabase
8. `pnpm add @prisma/client @supabase/supabase-js @supabase/ssr`
9. `pnpm add next-intl react-hook-form zod @hookform/resolvers`
10. `pnpm add @tanstack/react-table date-fns lucide-react sonner`
11. `pnpm add -D @trigger.dev/sdk @trigger.dev/nextjs`
12. Set up Supabase project in Singapore region, copy env vars to `.env.local`
13. Create `/src/lib/env.ts` with zod validation (§14)
14. Apply migrations from DATA_MODEL.md §16 in order
15. Run `pnpm prisma db pull` + `pnpm prisma generate`
16. Set up `/messages/th/*.json` and `/messages/en/*.json` stubs
17. Configure `middleware.ts` for locale resolution + auth
18. Set up lefthook hooks
19. Deploy to Vercel, connect Supabase via integration
20. Configure Trigger.dev, deploy tasks

After step 20, Milestone 1 of IMPLEMENTATION_PLAN.md can begin.

---

## 21. What this doc doesn't cover

- **How to use each tool** — see CONVENTIONS.md for patterns
- **Why we chose each design decision** — see PRODUCT_SPEC.md §7
- **Data model decisions** — see DATA_MODEL.md §19
- **Visual design decisions** — see DESIGN_SYSTEM.md §15
- **Build order and milestones** — see IMPLEMENTATION_PLAN.md (next)
- **Open questions that affect tech choices** — see OPEN_QUESTIONS.md (later)
