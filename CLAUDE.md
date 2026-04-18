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

- **Current milestone:** M4 — Budget (next up). M3 + M3.5 + M3.6 shipped.
- **Last completed:** M0/M1/M2 + **M3 Flips Core** + **M3.5 Invitations & Members** + **M3.6 Pivot / Re-underwriting + Revive + Remove Member** — all shipped. M3 delivered the full deal-to-flip workflow: `flips` + `flip_team_members` + `flip_code_counters` with RLS, atomic `FLIP-YYYY-###` code generation, createFlip-from-deal action, detail page (header + overview panel + team panel), stage transitions with terminal-stage guards, kill flow, `/flips` + `/flips/[id]` + `/flips/[id]/team` routes, "Convert to Flip" button on deal-analysis cards. M3.5 added `org_invitations` with SHA-256-hashed email-bound tokens, admin-only invite/revoke/remove-member actions, `/settings/members` page (tabs: members + pending invites), public `/invite/[token]` accept page, Members nav item, two SECURITY DEFINER DB functions bridging the RLS gap. M3.6 added `flip_revisions` with three compute modes (float_reunderwrite spread math, transfer_reunderwrite full-ARV math, pivot_to_transfer_in), `flips.flip_type` column that flips on pivot, contract-extension line items (refundable additional deposit + non-refundable additional expense), revive action for undoing kills, remove-member action with safety guards, `contract_expired` kill reason, target-profit row on the overview panel (colored by sign).
- **M1 deferred items** still outstanding (not needed for M4): forgot-password pages, locale switcher UI, `users.locale` persistence, dark mode toggle, unit tests for formatters, Playwright E2E tests.
- **M2 deferred items**: full property photo gallery (single thumbnail shipped; gallery stays in M11), unit + integration tests for deal-analysis compute (defer until vitest/playwright is wired).
- **M3 deferred items**: edit-flip UI (action exists but no form — overview panel still shows "—" for actuals until built); expanded `flip_portfolio_dashboard` view aggregates (budget in M4, tasks in M7); integration + Playwright tests for the flip flow.
- **M3.5 deferred items**: existing-user-joins-second-org is blocked (see memory `project_multi_org_gap.md`); no org-switcher UI; no transactional email — admins share links manually.
- **M3.6 deferred items** (see memory `project_post_m4_autofill.md`): sunk-cost fields in revision dialogs are manual-entry until M4 actuals tracking exists — pre-filling from budgets would mislead operators into thinking "spent exactly what was planned." Post-M4 follow-up: wire sunk fields to `SUM(budget_lines.actual_amount_thb)` per category.
- **Cross-cutting gaps tracked in memory:**
  - **Role permissions not enforced** beyond `admin` (invite/revoke/remove). Every other server action is open to any org member. See `project_role_permissions_gap.md`. Plan: wire per-feature as milestones land; full pass after M7.
- **Key architectural decisions made during M2:**
  - **shadcn token aliases in `globals.css`** — shadcn components reference `--color-popover`, `--color-accent`, `--color-muted-foreground` etc. which are mapped to ARC tokens. New shadcn primitives should consume ARC tokens directly (e.g. `bg-background`, `text-text-default`) rather than shadcn class names to avoid resolution ambiguity.
  - **Decimal serialization** — Prisma returns `Decimal` objects that can't cross the server/client boundary. Every query that feeds a Client Component must `Number()`-convert its Decimal columns (see `get-property.ts`, `get-flip.ts`, `list-flips.ts` for the pattern). Bites every time a new Decimal column is selected.
  - **`useTransition` + `revalidatePath` hang** — the `DealAnalysisForm` uses plain `useState` instead of `useTransition` because `useWatch` + `form.reset()` + `revalidatePath` inside a transition caused `isPending` to never settle. Only this form is affected; the pattern with `useTransition` is fine elsewhere.
  - **Storage bucket pattern** — `property-thumbnails` is public with UUID-based paths (`{orgId}/{uuid}.{ext}`). Adequate for internal tool; revisit with signed URLs pre-commercial.
- **Key architectural decisions made during M3 / M3.5 / M3.6:**
  - **Sequential entity codes via a counter table** — `flip_code_counters` (org_id, year, next_number) + single-statement `INSERT ... ON CONFLICT DO UPDATE ... RETURNING (next_number - 1)` is the concurrency-safe way to allocate per-org human codes. Reuse the pattern for future entities (POs, budget refs).
  - **`moveFlipToStage` blocks moves to `killed`** — users must call `killFlip` so reason capture is enforced. Moves from terminal stages (sold/killed) are blocked entirely. The stage `<Select>` hides `killed` from its options.
  - **Dev-server Prisma client caching** — `globalThis.db` caches the generated client in dev. After `prisma generate` you must fully restart `pnpm dev`; HMR won't re-import the client, and runtime calls (`db.flip.findMany`) will blow up with "cannot read properties of undefined".
  - **Invitation tokens: hashed at rest, email-locked.** SHA-256 in DB, raw only in URL. `chk_invitation_email_lower` CHECK keeps emails canonical. Unique partial index on `(org_id, email) WHERE pending` prevents duplicate outstanding invites.
  - **SECURITY DEFINER for anon/new-user flows.** `get_invitation_by_hash` and `accept_invitation` are the only paths that bypass RLS — the accepter has no `user_roles` row until the invite is consumed. `accept_invitation` is called via `supabase.rpc()` (not Prisma) so `auth.uid()` resolves from the JWT session cookie; a Prisma pooled connection wouldn't carry the claim.
  - **Admin check lives in app code, not RLS.** `isOrgAdmin()` at `src/server/shared/require-admin.ts`. RLS still enforces org-membership only; finer-grained gates are per-action. Keeps RLS policies simple and debuggable.
  - **Profit math branches by flip_type, not by revision_type alone.** `computeFlipRevisionTotals(mode, input)` has three modes: `float_reunderwrite` (spread math: new sale − SPA contract − costs), `transfer_reunderwrite` and `pivot_to_transfer_in` (both full-ARV math). The same `revision_type = 'reunderwrite'` record produces different math depending on the flip's current type at commit time. Pivot ALSO writes `flip_type = 'transfer_in'` on the flip, so any subsequent re-underwrite uses transfer math.
  - **Refundable vs non-refundable capital.** In float re-underwrite, `new_additional_deposit` counts in total capital deployed (affects ROI) but NOT in cost subtraction (refundable on success). `new_additional_expense` counts in both. This asymmetry is intentional — ROI needs capital-at-risk, profit needs actual cost.
  - **Revisions are append-only history.** No UPDATE policy on `flip_revisions`; correct a bad revision by writing a new one on top. The flip's `baseline_*` columns always reflect the latest revision's numbers.
  - **Sunk-cost inputs are manual until M4 budget actuals exist.** Pre-filling from budget values would mislead (assumes perfect adherence). See `memory/project_post_m4_autofill.md` for the M4 follow-up plan.
- **Next up:** M4 deliverables per `IMPLEMENTATION_PLAN.md` §7 — `budget_categories` + `budget_lines`, three-state tracking (budgeted / committed / actual), variance rollups, `/flips/[id]/budget` tab.
- **Ben's pending actions:** (1) rotate DB password, (2) upgrade Supabase to Pro before real data, (3) smoke-test M3 end-to-end before M4 starts (recommended so actuals/edit-flip gaps surface).

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

*Last updated: 2026-04-18 after M3 + M3.5 + M3.6 complete. If rules here drift from `CONVENTIONS.md`, the canonical doc wins — update this file to match.*
