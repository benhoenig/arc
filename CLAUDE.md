# CLAUDE.md

> Read this first every session. It's a map to deeper docs — not a textbook.

## Project in one paragraph

Property flipping management system for a Thai small-team operation. Internal tool first, commercial product later. Replaces Google Sheets chaos across 4 teams (Sourcing, PM, Contractor Manager, Sales) running 10+ simultaneous flips. **Central entity:** `Flip` (investment lifecycle on a `Property`). Everything hangs off the Flip.

**Stack:** Next.js 15 + TypeScript + Supabase (Postgres + RLS) + Prisma + Tailwind v4 + shadcn/ui + IBM Plex Sans Thai + next-intl.

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

- **Current milestone:** M0 — Bootstrap (not started)
- **Last completed:** —
- **Next up:** M0 deliverables per `IMPLEMENTATION_PLAN.md` §3

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

*Last updated: 2026-04-16. If rules here drift from `CONVENTIONS.md`, the canonical doc wins — update this file to match.*
