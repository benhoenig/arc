# CONVENTIONS.md

## Property Flipping Management System — Coding Conventions & Patterns
### The rulebook for every file Claude Code generates. When DATA_MODEL.md tells you *what*, this doc tells you *how*.

> **Reading this doc:** Every rule is a hard rule unless marked *preference* or *guideline*. When in doubt, pick the most boring option. Boring is predictable, predictable is debuggable, debuggable ships. Clever code is a liability in a vibe-coded codebase.

---

## 1. First principles

Five rules that override everything else in this document. If a convention below contradicts one of these, the principle wins.

1. **Consistency over cleverness.** Two slightly-worse patterns used everywhere beat one great pattern used in 40% of places. If you see existing code doing something, match it — even if you'd do it differently from scratch.

2. **Co-locate aggressively.** A feature's types, components, hooks, server actions, and tests live together in one folder. Shared things get hoisted only when something actually shares them. No premature abstraction.

3. **Server-first by default.** Every component is a React Server Component unless it needs state, effects, or browser APIs. Push `"use client"` as far down the tree as possible. Data fetching happens on the server, not in `useEffect`.

4. **Typesafe end-to-end, no exceptions.** Prisma types → zod schemas → form types → component props → server action returns. If there's a cast or an `any`, something is wrong.

5. **Respect RLS, don't bypass it.** Never use the Supabase service role key in application code paths. RLS is the security boundary. App-layer checks are defense-in-depth, never the primary gate.

---

## 2. Project structure

### 2.1 Top-level layout

```
/flipping-system
├── .env.local
├── .env.example
├── .gitignore
├── README.md
├── biome.json                    # linter + formatter config (NOT eslint + prettier)
├── components.json               # shadcn/ui config
├── next.config.ts
├── package.json
├── pnpm-lock.yaml                # use pnpm, not npm or yarn
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── middleware.ts                 # next-intl locale resolution + auth middleware
├── /docs                         # PRODUCT_SPEC.md, DATA_MODEL.md, etc. live here
├── /messages                     # i18n strings
│   ├── /th
│   └── /en
├── /prisma
│   ├── schema.prisma
│   └── /migrations               # mirror of supabase/migrations, generated
├── /supabase
│   ├── config.toml
│   ├── /migrations               # source of truth SQL migrations
│   ├── seed.sql
│   └── /functions                # edge functions (v2)
├── /public
└── /src
    ├── /app                      # Next.js App Router routes
    ├── /components               # shared UI (design system primitives)
    ├── /features                 # feature modules (the four pillars)
    ├── /lib                      # utilities, clients, helpers
    ├── /server                   # server-only code (actions, queries, validators)
    ├── /types                    # shared type definitions
    └── /styles                   # globals.css, tailwind layers
```

### 2.2 `/src/app` — routes

App Router with locale-aware routing via `next-intl`.

```
/src/app
├── /[locale]                     # locale segment: 'th' (default, no prefix in URL) or 'en'
│   ├── layout.tsx                # locale provider, fonts, theme
│   ├── not-found.tsx
│   ├── /(auth)                   # auth-only routes (login, signup — bypass app shell)
│   │   ├── layout.tsx
│   │   └── /login
│   │       └── page.tsx
│   ├── /(app)                    # authenticated app shell (sidebar, topbar)
│   │   ├── layout.tsx            # layout with sidebar + topbar; does auth check
│   │   ├── /dashboard
│   │   │   └── page.tsx
│   │   ├── /sourcing             # Pillar 1
│   │   │   ├── page.tsx
│   │   │   └── /[propertyId]
│   │   │       └── page.tsx
│   │   ├── /flips                # Pillar 2
│   │   │   ├── page.tsx
│   │   │   └── /[flipId]
│   │   │       ├── page.tsx
│   │   │       ├── /budget
│   │   │       ├── /timeline
│   │   │       ├── /team
│   │   │       └── /documents
│   │   ├── /contractors          # Pillar 3
│   │   ├── /investors            # Cross-cutting
│   │   ├── /listings             # Pillar 4
│   │   └── /settings
│   └── error.tsx                 # locale-aware error boundary
├── /api                          # only for webhooks/callbacks that can't be server actions
│   └── /webhooks
└── globals.css
```

**Rules:**
- **No `/th/` prefix in URLs.** Thai is default; English is explicit `/en/*`. Configured in `middleware.ts` via `next-intl`.
- **Route groups with parentheses** `(app)` and `(auth)` — never appear in URL, used for layout segmentation
- **Dynamic segments** use descriptive names: `[flipId]` not `[id]`
- **No catch-all routes** in v1 (no `[...slug]`)
- **Loading / error states** via `loading.tsx` and `error.tsx` in each route folder — every route that fetches data must have a `loading.tsx`
- **Metadata** generated per route via `generateMetadata` — every page has a title, Thai-first

### 2.3 `/src/features` — the four pillars + investor module

Each feature is self-contained. **This is where 80% of code lives.**

```
/src/features
├── /flips                        # Pillar 2 — Project Management
│   ├── components/               # flip-specific components (not in shared)
│   │   ├── flip-portfolio-table.tsx
│   │   ├── flip-detail-header.tsx
│   │   ├── flip-stage-pill.tsx
│   │   └── index.ts              # barrel export (feature-internal only)
│   ├── hooks/
│   │   └── use-flip-filters.ts
│   ├── queries/                  # Prisma queries — server only
│   │   ├── list-flips.ts
│   │   ├── get-flip.ts
│   │   └── get-flip-portfolio.ts
│   ├── actions/                  # Server Actions
│   │   ├── create-flip.ts
│   │   ├── update-flip.ts
│   │   └── kill-flip.ts
│   ├── validators/               # zod schemas
│   │   └── flip-schemas.ts
│   ├── types.ts                  # feature-specific types
│   └── constants.ts              # feature-specific constants
├── /sourcing                     # Pillar 1
├── /contractors                  # Pillar 3
├── /sales                        # Pillar 4 (listings + leads)
├── /investors                    # Cross-cutting
├── /budget                       # Cross-cutting (used by flips and investors)
└── /tasks                        # Cross-cutting
```

**Rules:**
- **Features never import from each other directly.** If `flips` needs something from `contractors`, that thing gets promoted to `/src/lib` or `/src/server/shared`. Cross-feature imports create hidden coupling.
- **Features CAN import from `/src/components`, `/src/lib`, `/src/server/*`, `/src/types`.**
- **Barrel exports (`index.ts`) only for feature-internal use.** Never export a feature's entire public surface.
- **Route pages import from features.** Route files stay thin — they're glue, not logic.

### 2.4 `/src/components` — shared UI primitives

```
/src/components
├── /ui                           # shadcn components (generated, customized to design tokens)
│   ├── button.tsx
│   ├── input.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   └── ...
├── /layout
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── app-shell.tsx
│   └── mobile-tabbar.tsx
├── /data-display
│   ├── currency.tsx              # formats THB with tabular nums per locale
│   ├── date.tsx                  # formats dates respecting Buddhist/Gregorian calendar
│   ├── variance.tsx              # budget variance display with semantic color
│   ├── pill.tsx                  # the one pill component (neutral + semantic variants)
│   ├── empty-state.tsx
│   └── skeleton-table.tsx
├── /form
│   ├── form-field.tsx            # wraps react-hook-form field + label + error
│   ├── currency-input.tsx        # THB input with right-aligned tabular number
│   ├── date-picker.tsx
│   ├── locale-select.tsx
│   └── confirm-delete-dialog.tsx
└── /icons                        # re-exports from lucide with consistent stroke-width
    └── index.ts
```

**Rule:** If a component is used in two or more features, it belongs here. If it's used in one feature, it stays in that feature's folder. Don't promote speculatively.

### 2.5 `/src/server` — server-only code

```
/src/server
├── db.ts                         # Prisma client (singleton, dev-hot-reload-safe)
├── supabase/
│   ├── server-client.ts          # createServerClient for RSC/actions
│   └── auth.ts                   # auth helpers (getCurrentUser, requireAuth, getOrgId)
├── /shared                       # cross-feature server utilities
│   ├── activity-log.ts
│   ├── rls-helpers.ts
│   └── notification-sender.ts
└── /integrations
    ├── line-notify.ts
    ├── resend.ts                 # v2
    └── trigger.ts                # Trigger.dev tasks
```

**Rule:** Any file in `/src/server` is server-only. Importing from it in a `"use client"` component is a compile error (enforced via `"server-only"` package import at the top of each file).

### 2.6 `/src/lib` — universal utilities

Runs in both server and client contexts. No DB access, no secrets, no server-only imports.

```
/src/lib
├── utils.ts                      # cn(), formatCurrency(), formatDate(), etc.
├── constants.ts                  # shared constants (locales, currency code, etc.)
├── formatters/
│   ├── currency.ts
│   ├── date.ts
│   └── number.ts
└── i18n.ts                       # next-intl config helpers
```

### 2.7 `/src/types` — shared types

```
/src/types
├── database.ts                   # re-exports from @prisma/client with conventions
├── i18n.ts                       # Locale type, Messages type
└── common.ts                     # Result<T>, Paginated<T>, etc.
```

---

## 3. Naming

### 3.1 Files and folders

| Type | Convention | Example |
|---|---|---|
| React component files | `kebab-case.tsx` | `flip-portfolio-table.tsx` |
| Hook files | `use-kebab-case.ts` | `use-flip-filters.ts` |
| Server action files | `verb-kebab-case.ts` | `create-flip.ts`, `approve-milestone.ts` |
| Query files | `verb-kebab-case.ts` | `list-flips.ts`, `get-flip.ts` |
| Validator files | `kebab-case-schemas.ts` | `flip-schemas.ts` |
| Utility files | `kebab-case.ts` | `currency.ts` |
| Route files | always `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` | — |
| Folders | `kebab-case` always | `/contractor-assignments` |

**Never:** PascalCase filenames, camelCase filenames, snake_case filenames, or file extensions other than `.ts` / `.tsx` / `.css` / `.md` / `.json` / `.sql`.

### 3.2 Identifiers in code

| Type | Convention | Example |
|---|---|---|
| React components | `PascalCase` | `FlipPortfolioTable` |
| Hooks | `camelCase` starting `use` | `useFlipFilters` |
| Server actions | `camelCase` verb-first | `createFlip`, `approveMilestone` |
| Query functions | `camelCase` verb-first | `listFlips`, `getFlipById` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_SIZE_BYTES` |
| Types / interfaces | `PascalCase`, no `I`-prefix | `Flip`, `BudgetLine` |
| Zod schemas | `camelCase` ending in `Schema` | `createFlipSchema` |
| Enums (object-as-enum) | `PascalCase` | `FlipStage` |
| Booleans | prefixed `is`, `has`, `can`, `should` | `isOverBudget`, `canApprove` |

### 3.3 Server actions: naming pattern

Server actions are the app's write API. Name them as verbs matching the operation, not as generic "handlers":

✅ `createFlip`, `updateBudgetLine`, `approvePayment`, `killFlip`, `assignContractor`
❌ `handleSubmit`, `saveFlip`, `doUpdate`, `flipAction`

### 3.4 Query functions: naming pattern

Queries read data. Use `get` for single-record-by-id, `list` for collections, `find` for search/filter:

✅ `getFlipById`, `listActiveFlips`, `findContractorsByTrade`, `getFlipBudgetSummary`
❌ `fetchFlip`, `queryFlips`, `flipService.get`

---

## 4. TypeScript rules

### 4.1 Strictness

`tsconfig.json` must have:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`noUncheckedIndexedAccess` is critical — it forces you to handle the "undefined" case when accessing array indices and object keys, which prevents ~40% of typical runtime bugs in data-heavy apps.

### 4.2 Types over interfaces

Always `type`, never `interface`. Exceptions: declaration merging (rare).

```ts
// ✅ Good
type Flip = {
  id: string;
  code: string;
};

// ❌ Bad
interface Flip {
  id: string;
  code: string;
}
```

### 4.3 Discriminated unions for states

Model state as a discriminated union, not as bags of nullables:

```ts
// ✅ Good
type PaymentStatus =
  | { status: 'requested'; requestedAt: Date; requestedBy: string }
  | { status: 'approved'; approvedAt: Date; approvedBy: string }
  | { status: 'paid'; paidAt: Date; paymentReference: string }
  | { status: 'rejected'; rejectedAt: Date; reason: string };

// ❌ Bad
type PaymentStatus = {
  status: string;
  requestedAt?: Date;
  approvedAt?: Date;
  paidAt?: Date;
  // ... which fields are valid for which status? Nobody knows.
};
```

### 4.4 No `any`, no non-null assertions

- `any` is banned. Use `unknown` and narrow.
- `!` non-null assertion is banned. If you're certain it's non-null, use `assert` or narrow properly.
- Type casts (`as X`) require a code comment explaining why.

### 4.5 Return types on exports

Every exported function must have an explicit return type. This catches regressions and makes refactoring safer.

```ts
// ✅ Good
export async function getFlipById(id: string): Promise<Flip | null> { ... }

// ❌ Bad
export async function getFlipById(id: string) { ... }
```

Internal functions within a file can rely on inference.

---

## 5. Prisma patterns

### 5.1 Schema organization

`prisma/schema.prisma` mirrors DATA_MODEL.md exactly. One model per table, same field order, same naming.

```prisma
model Flip {
  id                         String           @id @default(uuid()) @db.Uuid
  organizationId             String           @map("organization_id") @db.Uuid
  propertyId                 String           @map("property_id") @db.Uuid
  code                       String
  name                       String
  stageId                    String           @map("stage_id") @db.Uuid
  baselinePurchasePriceThb   Decimal?         @map("baseline_purchase_price_thb") @db.Decimal(14, 2)
  // ...
  createdAt                  DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                  DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt                  DateTime?        @map("deleted_at") @db.Timestamptz(6)

  organization               Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  property                   Property         @relation(fields: [propertyId], references: [id])
  stage                      FlipStage        @relation(fields: [stageId], references: [id])
  budgetLines                BudgetLine[]
  contractorAssignments      ContractorAssignment[]
  // ...

  @@unique([organizationId, code])
  @@index([organizationId])
  @@map("flips")
}
```

**Rules:**
- Every field gets `@map("snake_case_name")` to match SQL
- Every model gets `@@map("snake_case_plural")` — Prisma defaults to singular, we want plural
- `@@unique` and `@@index` clauses must match DATA_MODEL.md exactly
- Decimal fields always use `@db.Decimal(precision, scale)` — never Float for money
- UUID fields always use `@db.Uuid`
- Timestamp fields always use `@db.Timestamptz(6)`

### 5.2 Migration discipline

**Supabase migrations are the source of truth. Prisma migrations are generated from them.**

Workflow:
1. Write the SQL migration in `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`
2. Apply it: `supabase migration up`
3. Pull the schema into Prisma: `pnpm prisma db pull`
4. Generate the client: `pnpm prisma generate`
5. Commit both the SQL migration and the updated `schema.prisma`

**Never:**
- Use `prisma migrate dev` to create migrations (it doesn't know about RLS policies, triggers, or views)
- Edit a migration file after it has been applied in any environment
- Use `prisma db push` — no migration history, no rollback path

### 5.3 Prisma client singleton

```ts
// src/server/db.ts
import 'server-only';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

### 5.4 Soft-delete discipline

Every query on a business-data table must filter `deletedAt: null`. Enforced via a Prisma middleware:

```ts
// src/server/db.ts (continued)
db.$use(async (params, next) => {
  const softDeleteModels = new Set([
    'Flip', 'Property', 'BudgetLine', 'Contractor',
    'ContractorAssignment', 'Task', 'Milestone',
    'Investor', 'CapitalCommitment', 'Distribution',
    'Listing', 'Lead', 'Document', 'Comment',
    // (full list from DATA_MODEL.md)
  ]);

  if (!softDeleteModels.has(params.model ?? '')) return next(params);

  if (params.action === 'findUnique' || params.action === 'findFirst') {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  if (params.action === 'findMany') {
    params.args = params.args ?? {};
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    params.args.data = { ...params.args.data, deletedAt: new Date() };
  }

  return next(params);
});
```

**To explicitly include soft-deleted rows** (rare — e.g. audit views): use raw SQL or a dedicated helper that bypasses the middleware. Never disable the middleware globally.

### 5.5 Always filter by `organizationId`

Even though RLS enforces this at the DB, app-layer queries must also filter explicitly. Defense in depth.

```ts
// ✅ Good
export async function listActiveFlips(orgId: string): Promise<Flip[]> {
  return db.flip.findMany({
    where: {
      organizationId: orgId,
      soldAt: null,
      killedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ❌ Bad — RLS is there but app layer must also enforce
export async function listActiveFlips(): Promise<Flip[]> {
  return db.flip.findMany({ where: { soldAt: null, killedAt: null } });
}
```

### 5.6 Select only what you need

Don't `include` everything. Use explicit `select` for lists, `include` only when relations are actually rendered.

```ts
// ✅ Good — explicit about what the consumer needs
export async function listFlipsForDashboard(orgId: string) {
  return db.flip.findMany({
    where: { organizationId: orgId, soldAt: null, killedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      stage: { select: { slug: true, nameTh: true, nameEn: true } },
      property: { select: { nickname: true, district: true } },
      acquiredAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

### 5.7 Prisma transactions

Always use `db.$transaction` for multi-step writes. Don't use interactive transactions unless genuinely needed (they hold connections longer).

```ts
// ✅ Good — batch array of operations
await db.$transaction([
  db.flip.update({ where: { id }, data: { stageId: newStageId } }),
  db.activityLog.create({ data: { ... } }),
]);

// ✅ Also good — interactive when logic needs it
await db.$transaction(async (tx) => {
  const flip = await tx.flip.findUnique({ where: { id } });
  if (!flip) throw new Error('Flip not found');
  await tx.flip.update({ where: { id }, data: { stageId: newStageId } });
});
```

---

## 6. Supabase patterns

### 6.1 Two clients, not one

```ts
// src/server/supabase/server-client.ts — for RSC and server actions
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```ts
// src/lib/supabase/browser-client.ts — for "use client" components only
'use client';
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Rule:** Never use the service role key in application code. If you think you need to bypass RLS, you probably need a Postgres function with `SECURITY DEFINER` instead.

### 6.2 Auth helpers

```ts
// src/server/supabase/auth.ts
import 'server-only';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from './server-client';
import { db } from '@/server/db';

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function getActiveOrgId(): Promise<string> {
  const user = await requireAuth();

  // Org membership is determined by user_roles — there is always at least one
  const role = await db.userRole.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { organizationId: true },
  });

  if (!role) {
    throw new Error('User has no organization membership');
  }
  return role.organizationId;
}
```

**Every server action and every query function** must start with `const orgId = await getActiveOrgId()`. No exceptions.

### 6.3 File uploads

Supabase Storage paths are **always** org-scoped:

```
organizations/{orgId}/flips/{flipId}/{timestamp}-{filename}
organizations/{orgId}/contractors/{contractorId}/{timestamp}-{filename}
organizations/{orgId}/investors/{investorId}/{timestamp}-{filename}
```

Never a global bucket path. Never a user-scoped path. Always org-scoped. This is a one-way decision.

Upload happens client-side (compressed), then the server action records the `documents` row. Both operations must succeed or the upload is rolled back.

---

## 7. Server Actions

### 7.1 Standard shape

Every server action follows this pattern:

```ts
// src/features/flips/actions/create-flip.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/server/db';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import { logActivity } from '@/server/shared/activity-log';
import { createFlipSchema } from '../validators/flip-schemas';
import type { ActionResult } from '@/types/common';

export async function createFlip(
  input: z.infer<typeof createFlipSchema>
): Promise<ActionResult<{ flipId: string; code: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  // Validate
  const parsed = createFlipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const flip = await db.$transaction(async (tx) => {
      const code = await generateFlipCode(tx, orgId);

      const created = await tx.flip.create({
        data: {
          organizationId: orgId,
          propertyId: parsed.data.propertyId,
          stageId: parsed.data.stageId,
          code,
          name: parsed.data.name,
          baselinePurchasePriceThb: parsed.data.baselinePurchasePriceThb,
          baselineRenovationBudgetThb: parsed.data.baselineRenovationBudgetThb,
          baselineTargetArvThb: parsed.data.baselineTargetArvThb,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: created.id,
        action: 'created',
      });

      return created;
    });

    revalidatePath('/flips');
    return { ok: true, data: { flipId: flip.id, code: flip.code } };
  } catch (error) {
    console.error('createFlip failed', error);
    return { ok: false, error: 'server' };
  }
}
```

### 7.2 The `ActionResult` type

Every server action returns this shape. No thrown errors reach the client:

```ts
// src/types/common.ts
export type ActionResult<TData = void> =
  | { ok: true; data: TData }
  | { ok: false; error: 'validation'; issues: z.ZodIssue[] }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'conflict'; message?: string }
  | { ok: false; error: 'server' };
```

The client narrows on `result.ok` and handles each error case explicitly. No exceptions crossing the server-client boundary.

### 7.3 Rules

- **Always** start with `requireAuth()` and `getActiveOrgId()`
- **Always** validate with zod — never trust input
- **Always** wrap multi-step writes in `db.$transaction`
- **Always** call `logActivity` inside the transaction for auditable operations
- **Always** call `revalidatePath` or `revalidateTag` for affected routes
- **Never** throw errors to the client — return `ActionResult`
- **Never** redirect from inside an action (the client decides what to do post-success)

---

## 8. Data fetching in components

### 8.1 Server Components are the default

Route pages and most components are RSCs. Data fetched directly:

```tsx
// src/app/[locale]/(app)/flips/page.tsx
import { getActiveOrgId } from '@/server/supabase/auth';
import { listFlipsForDashboard } from '@/features/flips/queries/list-flips';
import { FlipPortfolioTable } from '@/features/flips/components/flip-portfolio-table';

export default async function FlipsPage() {
  const orgId = await getActiveOrgId();
  const flips = await listFlipsForDashboard(orgId);

  return <FlipPortfolioTable flips={flips} />;
}
```

### 8.2 Client Components are the exception

Use `"use client"` only when the component needs:
- `useState`, `useReducer`, `useEffect`
- Event handlers (onClick, onChange)
- Browser APIs (localStorage is banned anyway — see Section 17)
- Third-party client libraries (e.g. a date picker)

**Never** fetch data in `useEffect` unless it genuinely can't be done on the server (e.g. depends on user interaction).

### 8.3 The "island" pattern

Pattern: Server Component fetches data → passes to Client Component island for interactivity.

```tsx
// Server Component (default)
export default async function FlipsPage() {
  const flips = await listFlipsForDashboard(orgId);
  return <FlipPortfolioTableClient initialFlips={flips} />;
}

// Client Component — just the interactive shell
'use client';
export function FlipPortfolioTableClient({ initialFlips }: Props) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => filterFlips(initialFlips, filter), [initialFlips, filter]);
  return <Table data={filtered} />;
}
```

### 8.4 When to use a client-side data library

`@tanstack/react-query` is permitted **only** for:
- Polling (e.g. live dashboard updates)
- Optimistic updates where RSC revalidation is too slow to feel good
- Infinite scrolling lists

Not for: initial data loading (use RSC), cross-component data sharing (pass props or use Server Actions + revalidation).

---

## 9. Forms — the standard pattern

All forms use `react-hook-form` + `zod` + shadcn `<Form>` primitives. One pattern, everywhere.

### 9.1 The full pattern

```tsx
// src/features/flips/components/create-flip-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { createFlipSchema } from '../validators/flip-schemas';
import { createFlip } from '../actions/create-flip';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/form/currency-input';
import { Button } from '@/components/ui/button';

type Props = { propertyId: string; onSuccess?: (flipId: string) => void };

export function CreateFlipForm({ propertyId, onSuccess }: Props) {
  const t = useTranslations('flips.create');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<z.infer<typeof createFlipSchema>>({
    resolver: zodResolver(createFlipSchema),
    defaultValues: {
      propertyId,
      name: '',
      baselinePurchasePriceThb: 0,
      baselineRenovationBudgetThb: 0,
      baselineTargetArvThb: 0,
    },
  });

  function onSubmit(values: z.infer<typeof createFlipSchema>) {
    startTransition(async () => {
      const result = await createFlip(values);

      if (!result.ok) {
        if (result.error === 'validation') {
          result.issues.forEach((issue) => {
            form.setError(issue.path.join('.') as any, { message: issue.message });
          });
          return;
        }
        toast.error(t(`errors.${result.error}`));
        return;
      }

      toast.success(t('success', { code: result.data.code }));
      onSuccess?.(result.data.flipId);
      router.push(`/flips/${result.data.flipId}`);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.name')}</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ...more fields */}
        <Button type="submit" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}
```

### 9.2 Form rules

- **Always** `react-hook-form` + `zod`. Never controlled inputs with raw `useState`.
- **Always** `useTransition` for submissions — never raw `async` handlers.
- **Always** map server validation errors back onto form fields via `form.setError`.
- **Always** show errors inline (field-level), not in a top banner.
- **Never** use native HTML form submission. `<form onSubmit={form.handleSubmit(...)}>` always.
- **Never** use `action={serverAction}` directly on a `<form>` — we need the `useTransition` pending state for button disabling.
- **Currency inputs** use `<CurrencyInput>`, never raw `<Input type="number">` — locale formatting matters.
- **Buttons** disable during `isPending`, show loading text, never an inline spinner (see DESIGN_SYSTEM.md).

### 9.3 Zod schema colocation

Zod schemas live in `/validators/` at the feature level. The same schema is used by:
1. The form (via `zodResolver`)
2. The server action (via `.safeParse`)

**One schema per mutation.** Never share schemas across create/update — they have different required fields.

```ts
// src/features/flips/validators/flip-schemas.ts
import { z } from 'zod';

export const createFlipSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  stageId: z.string().uuid(),
  baselinePurchasePriceThb: z.coerce.number().positive(),
  baselineRenovationBudgetThb: z.coerce.number().nonnegative(),
  baselineTargetArvThb: z.coerce.number().positive(),
  baselineTargetTimelineDays: z.coerce.number().int().positive().optional(),
});

export const updateFlipSchema = createFlipSchema.partial().extend({
  id: z.string().uuid(),
});

export const killFlipSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(['pivoted_to_rental', 'deal_collapsed', 'market_change', 'other']),
  notes: z.string().max(2000).optional(),
});
```

---

## 10. Tables — the standard pattern

Tables are 70% of this UI. They all follow one pattern: `@tanstack/react-table` + the shadcn `Table` primitives + our density tokens.

### 10.1 Standard pattern

```tsx
// src/features/flips/components/flip-portfolio-table.tsx
'use client';

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pill } from '@/components/data-display/pill';
import { Currency } from '@/components/data-display/currency';
import { Variance } from '@/components/data-display/variance';
import type { FlipDashboardRow } from '../types';

type Props = { flips: FlipDashboardRow[] };

export function FlipPortfolioTable({ flips }: Props) {
  const t = useTranslations('flips.table');

  const columns: ColumnDef<FlipDashboardRow>[] = [
    {
      accessorKey: 'code',
      header: t('columns.code'),
      cell: ({ row }) => (
        <Link href={`/flips/${row.original.id}`} className="font-medium hover:underline">
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: 'stage',
      header: t('columns.stage'),
      cell: ({ row }) => <Pill variant="neutral">{row.original.stageName}</Pill>,
    },
    {
      accessorKey: 'budgetVariance',
      header: t('columns.budgetVariance'),
      cell: ({ row }) => <Variance amount={row.original.varianceThb} percent={row.original.variancePct} />,
    },
    // ...
  ];

  const table = useReactTable({
    data: flips,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>{/* render from table.getHeaderGroups() */}</TableHeader>
      <TableBody>{/* render from table.getRowModel().rows */}</TableBody>
    </Table>
  );
}
```

### 10.2 Table rules

- **Always** `@tanstack/react-table` — never hand-rolled tables for non-trivial data
- **Numbers are right-aligned**, tabular figures, via the `<Currency>` or `<Variance>` components
- **Clickable rows** navigate via `<Link>` in the first cell (not `onClick` on `<tr>`)
- **Sorting** — use tanstack's sort model; clickable column headers
- **Empty state** — show `<EmptyState>` when `flips.length === 0`, never a table with "No data" inside it
- **Loading state** — show `<SkeletonTable rows={8} />` during SSR streaming or client fetches
- **Pagination** — only if more than 50 rows; default page size 50
- **No zebra striping**, no row shadows, no dividers other than the `--color-border-subtle` bottom border per row

---

## 11. Component conventions

### 11.1 Function components, named exports

```tsx
// ✅ Good
export function FlipPortfolioTable({ flips }: Props) { ... }

// ❌ Bad
export default function FlipPortfolioTable(props: Props) { ... }
const FlipPortfolioTable: React.FC<Props> = (props) => { ... };
```

**Exception:** route files (`page.tsx`, `layout.tsx`) use `export default` — Next.js requires it.

### 11.2 Props typing

```tsx
// ✅ Good — type alias co-located with component
type Props = {
  flipId: string;
  onApprove?: (milestoneId: string) => void;
  children: React.ReactNode;
};

export function MilestoneList({ flipId, onApprove, children }: Props) { ... }

// ❌ Bad — inline Props, or named "FlipListProps"
export function MilestoneList(props: { flipId: string }) { ... }
export function MilestoneList({ flipId }: MilestoneListProps) { ... }
```

Always use a local `type Props = { ... }` right above the component. Name it `Props`, not `FooProps`.

### 11.3 Composition over configuration

Prefer `children` and slot props over giant props grids.

```tsx
// ✅ Good
<Card>
  <Card.Header>
    <Card.Title>{flip.name}</Card.Title>
    <Card.Actions><Button>Edit</Button></Card.Actions>
  </Card.Header>
  <Card.Body>...</Card.Body>
</Card>

// ❌ Bad
<Card
  title={flip.name}
  showEditButton
  onEdit={...}
  bodyContent={...}
/>
```

### 11.4 Ref forwarding

Only forward refs when a component is likely to be used as a form element target or a focus target. Most components don't need it. Don't add `forwardRef` speculatively.

### 11.5 The `cn()` helper

Always merge classNames via the `cn()` helper (combines `clsx` + `tailwind-merge`). Never string concatenation.

```tsx
// ✅ Good
<div className={cn('flex items-center gap-2', isActive && 'font-medium', className)}>

// ❌ Bad
<div className={`flex items-center gap-2 ${isActive ? 'font-medium' : ''} ${className}`}>
```

---

## 12. Tailwind & styling

### 12.1 Use tokens, never raw values

Design tokens from DESIGN_SYSTEM.md are the Tailwind theme. Use them exclusively:

```tsx
// ✅ Good
<div className="text-text-default bg-surface border border-border p-4">

// ❌ Bad — literal colors
<div className="text-[#262626] bg-[#FAFAFA] border border-[#E5E5E5]">

// ❌ Bad — Tailwind default palette
<div className="text-gray-800 bg-gray-50 border border-gray-200">
```

### 12.2 No arbitrary values

No `w-[437px]`, no `text-[17px]`, no `p-[23px]`. If the scale doesn't have it, either add it to the scale (with justification) or pick the closest scale value.

### 12.3 No `@apply`, no custom CSS classes

Almost never. If you think you need `@apply`, you're probably building the wrong abstraction. The exceptions: global reset, font-face declarations, and tabular-nums utility.

### 12.4 Responsive breakpoints

- `sm:` mobile-first base
- `md:` ≥ 768px — tablet, sidebar appears
- `lg:` ≥ 1024px — desktop, full density
- `xl:` ≥ 1280px — wide desktop, max-width kicks in

Design mobile-first. Add desktop variants only when layout genuinely differs.

### 12.5 Dark mode

Use `dark:` modifier. Never build light-only or dark-only components. Verify every component in both modes before merging.

```tsx
<div className="bg-background dark:bg-background text-text-default dark:text-text-default">
```

Since the tokens already contain dark-mode values via CSS variables, most components don't need `dark:` modifiers — the variables handle it. Use `dark:` only for binary toggles that CSS variables can't express.

---

## 13. i18n (next-intl) patterns

### 13.1 Setup

```ts
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/lib/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}/index.json`)).default,
  };
});
```

### 13.2 Message file organization

```
/messages/th/
  common.json
  flips.json
  budget.json
  contractors.json
  ...
  index.json          # auto-generated: merges all namespaces
```

Never import specific namespaces directly — the build step merges them. Always use `useTranslations('namespace')`.

### 13.3 Using translations

**In Server Components:**
```tsx
import { getTranslations } from 'next-intl/server';

export default async function FlipsPage() {
  const t = await getTranslations('flips');
  return <h1>{t('title')}</h1>;
}
```

**In Client Components:**
```tsx
'use client';
import { useTranslations } from 'next-intl';

export function FlipCard() {
  const t = useTranslations('flips.card');
  return <div>{t('openActions')}</div>;
}
```

### 13.4 Authoring rules

- **Every user-facing string goes through `t()`.** No literals, no "TODO translate this later."
- **Thai is authored first**, English translated from Thai.
- **Placeholders, not concatenation:**
  ```json
  // ✅ Good
  "overdueCount": "{count} งานเลยกำหนด"
  // ❌ Bad — breaks in English and Thai word order
  "overduePrefix": "You have "
  "overdueSuffix": " overdue tasks"
  ```
- **ICU pluralization** for counts:
  ```json
  "flipCount": "{count, plural, =0 {ไม่มี flip} one {1 flip} other {# flips}}"
  ```
  (Note: Thai doesn't use plural forms — the `other` branch is what Thai renders. ICU still works.)
- **Dates and numbers are formatted by the lib:**
  ```tsx
  const format = useFormatter();
  format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' });
  format.number(amount, { style: 'currency', currency: 'THB' });
  ```

### 13.5 Thai Buddhist Era dates

```ts
// src/lib/formatters/date.ts
export function formatDate(date: Date, locale: 'th' | 'en'): string {
  if (locale === 'th') {
    // Thai Buddhist Era: add 543 years
    const beYear = date.getFullYear() + 543;
    const month = new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(date);
    const day = date.getDate();
    return `${day} ${month} ${beYear}`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}
```

All date rendering goes through `formatDate`. Never `date.toLocaleString()` directly.

### 13.6 Currency formatting

```ts
// src/lib/formatters/currency.ts
export function formatCurrency(amount: number | Decimal, locale: 'th' | 'en'): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (locale === 'th') {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(value);  // → ฿1,234,567
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);  // → THB 1,234,567
}
```

### 13.7 Lookup table translations

For seeded data with `name_th` / `name_en` (stages, categories, roles):

```ts
// src/lib/i18n.ts
export function getLocalizedName<T extends { nameTh: string; nameEn: string | null }>(
  item: T,
  locale: 'th' | 'en'
): string {
  if (locale === 'en') return item.nameEn ?? item.nameTh;
  return item.nameTh;
}
```

Always use this helper. Never `locale === 'th' ? x.nameTh : x.nameEn`.

---

## 14. Error handling

### 14.1 Error boundaries

Every route has an `error.tsx`:

```tsx
// src/app/[locale]/(app)/flips/error.tsx
'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors.page');
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <h2>{t('title')}</h2>
      <Button onClick={reset} variant="secondary">{t('retry')}</Button>
    </div>
  );
}
```

### 14.2 Toast on action failure

Server action returns `{ ok: false, error: 'server' }` → client shows toast with the localized message for that error key. Never show raw error messages to users.

### 14.3 Logging

Server-side errors go to `console.error` in v1. Wrap with Sentry in v2. Never leak stack traces to clients. Include context:

```ts
console.error('createFlip failed', {
  orgId,
  userId: user.id,
  input: parsed.data,
  error,
});
```

### 14.4 The three error categories

1. **Validation errors** — expected, user's input was wrong. Show inline on the form field.
2. **Business errors** — expected, operation can't be completed (e.g. `not_found`, `forbidden`, `conflict`). Show toast with specific message.
3. **Server errors** — unexpected, something broke. Show generic toast "Something went wrong. Please try again." Log full detail server-side.

The `ActionResult` discriminated union forces you to handle all three.

---

## 15. Testing (v1 scope)

Minimal but real. Vibe-coded doesn't mean untested.

### 15.1 What we test in v1

- **Validators (zod schemas)** — unit tests for edge cases
- **Business logic functions** — pure functions like `calculateInvestorReturn`, `computeBudgetVariance`
- **Server actions** — integration tests that hit a test DB
- **Critical UI flows** — Playwright for login, create-flip, approve-payment (only the most critical flows)

### 15.2 What we don't test in v1

- Every component individually (too much overhead, too little value for rapidly-iterating UI)
- RSC data fetching (Next.js handles this; we trust the framework)
- Styling (visual regressions come in v2 via Percy or Chromatic)

### 15.3 Framework choice

- **Vitest** for unit and integration tests
- **Playwright** for E2E
- Tests live next to source: `create-flip.ts` + `create-flip.test.ts`

### 15.4 Test DB

Local Supabase instance via `supabase start`. Each test file starts with a fresh seeded org. Tests run in a transaction and rollback — never commit test data.

---

## 16. Linting & formatting

### 16.1 Biome, not ESLint + Prettier

**Biome** for linting and formatting. One tool, fast, no config hell.

```json
// biome.json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noDefaultExport": "error",
        "useBlockStatements": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "error"
      },
      "complexity": {
        "noBannedTypes": "error"
      }
    }
  }
}
```

Exception: route files need default exports; override for `/src/app/**/*`.

### 16.2 Git hooks

`lefthook` runs `biome check` + `tsc --noEmit` on pre-commit. No commits without passing types and lints. Non-negotiable.

### 16.3 Import order

Biome enforces this automatically:
1. Built-in Node modules
2. External packages
3. `@/server/**` imports
4. `@/features/**` imports
5. `@/components/**` imports
6. `@/lib/**` and `@/types/**` imports
7. Relative imports
8. Type-only imports last (`import type { ... }`)

---

## 17. What we never do

Hard bans. Violating any of these is a bug, even if it "works."

1. **No `localStorage` or `sessionStorage`** — use server-side state or cookies. Period.
2. **No `process.env` access outside of `/src/lib/env.ts`** — centralized, typed env. Claude Code must not reach for `process.env.FOO` directly.
3. **No `service_role` key in app code** — ever. If you're about to, stop.
4. **No `any`** — use `unknown` and narrow.
5. **No `!` non-null assertion** — narrow properly or `assert`.
6. **No `as` casts without a comment** — explain why.
7. **No `console.log` in committed code** — `console.error` for errors only, nothing else.
8. **No direct DB access from Client Components** — always through a server action or a RSC.
9. **No inline styles** — Tailwind classes only. (Exception: dynamic values that must be pixel-calculated, rare.)
10. **No `dangerouslySetInnerHTML`** — sanitize on the server, render as text. If truly needed, wrap with DOMPurify and leave a comment.
11. **No `useEffect` for data fetching** — server-first, always.
12. **No `memo`, `useMemo`, `useCallback` speculatively** — only with a measured reason. Premature optimization obscures code.
13. **No circular imports** — Biome enforces this.
14. **No `@ts-ignore` or `@ts-expect-error` without an attached issue number** — these are debts, not solutions.
15. **No global state libraries (Redux, Zustand, Jotai, etc.)** — we use RSC + Server Actions + `react-hook-form`. If you think you need global state, you're solving the wrong problem.
16. **No class components** — function components only.
17. **No prop drilling more than 2 levels** — lift, compose, or use context (in that order of preference).
18. **No `Date.now()` or `new Date()` in components** — times are server-rendered, passed as props. Client Components that display "time ago" use a tiny library (`date-fns`) and re-render on an interval if needed.

---

## 18. What we always do

The mirror of Section 17. Positive rules:

1. **Always validate input with zod** at the server action boundary
2. **Always filter by `organizationId`** in app-layer queries
3. **Always filter `deletedAt: null`** (Prisma middleware does this, but don't bypass it)
4. **Always use tabular-nums for numeric columns and currency displays**
5. **Always show loading state via skeleton, not spinner**
6. **Always confirm before destructive actions** via `<ConfirmDeleteDialog>`
7. **Always route user-facing strings through `t()`**
8. **Always use `<Currency>` / `<Date>` / `<Variance>` components** for formatted values
9. **Always use `ActionResult` as server action return type**
10. **Always co-locate zod schema, server action, and form for a given mutation**

---

## 19. Commit conventions

Conventional Commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.
Scopes match feature folders: `flips`, `budget`, `contractors`, `investors`, `sales`, `shared`.

Examples:
- `feat(flips): add flip portfolio dashboard table`
- `fix(budget): correct variance calculation for zero-budget categories`
- `refactor(contractors): extract payment-model discriminator into hook`

No auto-generated commits from AI tools without review. Claude Code should not commit; Ben commits.

---

## 20. Definition of done

A feature is done when:

1. The server action has a zod schema, returns `ActionResult`, and includes `logActivity`
2. The query function filters by `organizationId` and `deletedAt: null`
3. The form uses `react-hook-form` + `zod` + `<Form>` primitives
4. All user-facing strings are in `/messages/th/*.json` AND `/messages/en/*.json`
5. The component works in both light and dark mode
6. The component works on mobile (≤ 375px wide) and desktop
7. Empty, loading, and error states are handled
8. `pnpm tsc --noEmit` passes
9. `pnpm biome check` passes
10. Playwright test exists for the happy path if it's in the critical flow list

If any of these fails, the feature isn't done — regardless of how much code was written.

---

## 21. Decisions captured here (for the record)

| # | Decision | Rationale |
|---|---|---|
| 1 | pnpm, not npm/yarn | Fast, disk-efficient, correct workspace handling |
| 2 | Biome, not ESLint + Prettier | One tool; 10x faster; zero config drift |
| 3 | Feature folders under `/src/features` | Co-location beats file-type folders at scale |
| 4 | Server Actions for all writes | Simpler than API routes; typesafe end-to-end |
| 5 | `ActionResult` discriminated union | Forces exhaustive error handling client-side |
| 6 | Supabase migrations as source of truth, Prisma pulls | Prisma can't express RLS, triggers, views |
| 7 | `getActiveOrgId` as app-layer gate | Defense-in-depth alongside RLS |
| 8 | Prisma middleware for soft-delete | Single enforcement point; can't be forgotten |
| 9 | `react-hook-form` + `zod` for all forms | One pattern; shared schema with server |
| 10 | `@tanstack/react-table` for all tables | 70% of UI is tables; need a real solution |
| 11 | `next-intl` for i18n; Thai-first authoring | Thai is the source voice, not a translation |
| 12 | Buddhist Era dates for Thai locale | Matches Thai legal/financial context |
| 13 | No global state libraries | RSC + Server Actions covers 99% of needs |
| 14 | Biome enforces import order, no default exports | Consistency without arguments |
| 15 | `pnpm tsc --noEmit` + `biome check` on pre-commit | Bugs found in seconds, not hours |
| 16 | Tests: Vitest + Playwright, minimal v1 scope | Test the hard stuff, not the framework |
| 17 | Definition of done checklist | Prevents "it works on my machine" shipping |

---

## 22. What this doc doesn't cover (yet)

Reserved for future updates or separate docs:

- **API_CONTRACTS.md** — if/when public API is added (v2)
- **DEPLOYMENT.md** — CI/CD, Vercel config, environment promotion
- **OBSERVABILITY.md** — Sentry, logs, metrics (v2)
- **ACCESSIBILITY_AUDIT.md** — WCAG audit results (v2)
- **PERFORMANCE_BUDGET.md** — Core Web Vitals targets, bundle size limits (v2)
- **RUNBOOK.md** — on-call procedures, incident response (v2, once commercial)

These are genuinely out of scope until the product has real users.
