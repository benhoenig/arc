# CLAUDE.md

> Read this first every session. It's a map to deeper docs — not a textbook.

## Project in one paragraph

Property flipping management system for a Thai small-team operation. Internal tool first, commercial product later. Replaces Google Sheets chaos across 4 teams (Sourcing, PM, Contractor Manager, Sales) running 10+ simultaneous flips. **Central entity:** `Flip` (investment lifecycle on a `Property`). Everything hangs off the Flip.

**Stack:** Next.js 16 + TypeScript + Supabase (Postgres + RLS) + Prisma 7 + Tailwind v4 + shadcn/ui + IBM Plex Sans Thai + next-intl 4. App package name is `arc`; GitHub repo is `benhoenig/arc`.

## Where things are documented

Read the relevant doc before generating code. Don't guess at patterns.

| Need to... | Read |
|---|---|
| Understand scope or vision | `docs/PRODUCT_SPEC.md` |
| Write SQL / migration / query | `docs/DATA_MODEL.md` |
| Style or build UI | `docs/DESIGN_SYSTEM.md` |
| Write any code | `docs/CONVENTIONS.md` |
| Know which tool/version | `docs/TECH_STACK.md` |
| Know what to build next | `docs/IMPLEMENTATION_PLAN.md` |

## Current build state

> **Ben: update this after each milestone.**

- **Current milestone:** M3 — Flips Core (starting)
- **Last completed:** M0 Bootstrap + M1 Foundation + M2 Properties & Deal Analysis — all shipped. Sourcing workflow end-to-end: property library (table + Kanban), property create/edit with thumbnails, deal analysis CRUD with label/edit/delete + pursue/pass decisions, contacts directory (with sub-nav), projects directory, drag-and-drop pipeline Kanban across 8 status columns. Shared form primitives in place: `<NumberInput>` (thousand separators), `<ComboboxPicker>` (search + create-inline), `<ThumbnailUpload>` (direct to Supabase Storage). Two `deal_analyses` columns added post-initial: `label`, `other_cost_thb`. Contact type enum simplified: `seller` merged into `owner`.
- **M1 deferred items** still outstanding (not needed for M3): forgot-password pages, locale switcher UI, `users.locale` persistence, dark mode toggle, unit tests for formatters, Playwright E2E tests (signup flow + cross-tenant leak — now actually viable since property detail URLs exist).
- **M2 deferred items**: full property photo gallery (single thumbnail shipped; gallery stays in M11), unit + integration tests for deal-analysis compute (defer until vitest/playwright is wired).
- **Key architectural decisions made during M2:**
  - **shadcn token aliases in `globals.css`** — shadcn components reference `--color-popover`, `--color-accent`, `--color-muted-foreground` etc. which are mapped to ARC tokens. New shadcn primitives should consume ARC tokens directly (e.g. `bg-background`, `text-text-default`) rather than shadcn class names to avoid resolution ambiguity.
  - **Decimal serialization** — Prisma returns `Decimal` objects that can't cross the server/client boundary. Every query that feeds a Client Component must `Number()`-convert its Decimal columns (see `get-property.ts`, `get-contact.ts`, `get-project.ts` for the pattern). This bites every time a new Decimal column is selected.
  - **`useTransition` + `revalidatePath` hang** — the `DealAnalysisForm` uses plain `useState` instead of `useTransition` because `useWatch` + `form.reset()` + `revalidatePath` inside a transition caused `isPending` to never settle. Only this form is affected; the pattern with `useTransition` is fine elsewhere (no `useWatch` re-computation).
  - **Storage bucket pattern** — `property-thumbnails` is public with UUID-based paths (`{orgId}/{uuid}.{ext}`). Adequate for internal tool; revisit with signed URLs pre-commercial. RLS allows authenticated insert and owner-scoped update/delete.
- **Next up:** M3 deliverables per `IMPLEMENTATION_PLAN.md` §6 — `flips` table + `flip_team_members` + RLS, convert-pursued-deal-to-flip action, flip detail page with stages/team/baseline budget, `/flips` index.
- **Ben's pending actions:** (1) rotate DB password, (2) upgrade Supabase to Pro before real data.

If a request is out of sequence with the current milestone, flag it.

## The rules that matter most

Full list: `CONVENTIONS.md` §17–18. The critical ones to hold firm on:

- **Multi-tenant safety:** every table has `organization_id` + RLS; every action starts with `requireAuth()` + `getActiveOrgId()`; every query filters by `organizationId` explicitly. Never use `service_role` in app code.
- **Migrations:** Supabase SQL is source of truth, not Prisma. Never `prisma migrate dev` / `db push`. Never edit an applied migration.
- **Type safety:** no `any`, no `!`, no `as X` without a comment. Server actions return `ActionResult<T>`, never throw to client.
- **Design:** monochrome base; color only on signals with good/bad directionality (budget variance, overdue, payment outcomes). Stages/roles/categories/priorities stay neutral. No Tailwind default palette. No arbitrary values.
- **i18n:** Thai authored first, English translated. Every string through `t()`. Buddhist Era dates in Thai locale.
- **No:** `localStorage`, `useEffect` for data fetching, global state libs, `console.log`, `process.env` outside `src/lib/env.ts`.

## The directionality test (most-applied rule)

Before applying color to any indicator: **does this state have an objectively better/worse version?**

- Yes → semantic variant (positive / warning / destructive) allowed
- No → neutral, always

"Sold" is a stage — neutral. "Paid" is an outcome — positive. "Approved" is mid-workflow — neutral. "Over budget 15%" is a state — destructive.

Full rules: `DESIGN_SYSTEM.md` §2.2.

## How to work with Ben

- He vibe-codes. He tells you what, you handle how — don't ask "hooks or class?"
- Match existing patterns over inventing better ones. Consistency > cleverness.
- Be direct. If a request will cause a problem, say so concretely + suggest the alternative + reference the doc.
- State decisions first, reasoning after. Don't write essays.
- Flag assumptions explicitly. Prefer making a call + noting it over asking five clarifying questions.
- When you deviate from a convention, say so and why.

## When in doubt

Consult the doc. If the doc doesn't cover it, ask Ben. Don't invent.

---

*Last updated: 2026-04-18 after M2 complete. If rules here drift from `CONVENTIONS.md`, the canonical doc wins — update this file to match.*
