# PRODUCT_SPEC.md

## Property Flipping Management System
### Internal Tool v1 → Commercial Product v2

---

## 1. Vision & Context

### 1.1 What this is
An operational system of record for small-team property flipping businesses, replacing the scattered Google Sheets that currently run the operation. It connects four operational domains — sourcing, project management, contractor execution, and sales — around a single source of truth: the **Flip**.

### 1.2 Why it exists
The current operation runs on a fragmented graveyard of Google Sheets spread across Google Drive with no source of truth. Ten-plus simultaneous flips across four teams (sourcing, project management, contractor management, sales & marketing) cannot be coordinated through disconnected sheets. The cost is not just inefficiency — it is cost overruns, missed timelines, and invisible risk that only surfaces at exit.

### 1.3 Strategic path (Path B — Internal-first, Commercial-later)
This product is being built internally first, to serve the operator's own flipping business as customer zero. The data model, permissions structure, and architecture are being designed from day one to support commercialization to the Thai property flipper market within 12–18 months.

**What this means in practice:**
- Multi-tenancy is designed into the schema from v1, even though only one tenant (the operator's business) will exist in production for 6–12 months
- RBAC is modeled in the data layer from v1, even though UI for permissions management is deferred
- Investor-facing features are built into v1 because investor capital is currently in use
- Branding, theming, and copy are kept neutral and product-like, not business-specific

### 1.4 Target customer (future commercial version)
Thai small-team property flipping businesses managing 5+ simultaneous flips with 3–10 internal team members and investor capital. Initial commercial launch assumes warm-intro distribution to flippers the operator knows personally.

---

## 2. Core Data Model

### 2.1 Central entities

The system is structured around two central entities, with all other concepts orbiting them:

**Property** — the physical asset
- Represents a unique piece of real estate, identified by address and legal identifiers
- Persists across multiple transactions; a property may be evaluated, passed on, bought, sold, and re-bought
- Stores immutable-ish facts: location, land area, building specs, legal documents, historical photos

**Flip** — the project/journey on a Property
- Represents a single investment lifecycle on a Property
- Has a lifecycle: `sourcing → underwriting → acquiring → renovating → listing → under_offer → sold` (plus `on_hold`, `killed`)
- Owns the budget, the timeline, the team assignments, and the investor capital structure
- All workflow data (tasks, budget lines, contractor assignments, marketing listings, investor reports) hangs off the Flip, not the Property

This mirrors the ECHO Contact/Deal split and prevents the "one-hot-property-became-two-flips" edge case.

### 2.2 Core tables (v1 scope)

| Table | Purpose | Key relationships |
|---|---|---|
| `organizations` | Multi-tenant root | Owns everything |
| `users` | Team members | Belongs to organization |
| `roles` | RBAC definitions | Org-scoped |
| `user_roles` | User ↔ role junction | User + role + optional flip scope |
| `properties` | Physical assets | Org-scoped |
| `flips` | Investment lifecycles | Property + org |
| `flip_stages` | Pipeline stages config | Org-scoped (customizable) |
| `flip_team_members` | Who works on what flip | Flip + user + role in flip |
| `deal_analyses` | Sourcing underwriting snapshots | Property (pre-flip) + flip (if acquired) |
| `budget_categories` | Renovation cost buckets | Org-scoped (customizable) |
| `budget_lines` | Budgeted vs actual line items | Flip + category + contractor |
| `contractors` | Contractor records (companies/individuals) | Org-scoped |
| `contractor_assignments` | Contractors per flip | Flip + contractor + scope of work |
| `contractor_payments` | Payment records | Assignment + date + amount + status |
| `tasks` | Unit of work | Flip + assignee + stage |
| `milestones` | Timeline checkpoints | Flip + target date + actual date |
| `documents` | Files (photos, docs, contracts) | Polymorphic: flip / property / contractor / investor |
| `investors` | Capital providers | Org-scoped |
| `capital_commitments` | Investor ↔ flip capital | Investor + flip + amount + terms |
| `distributions` | Payouts to investors | Commitment + date + amount + type |
| `listings` | Resale marketing | Flip + platform + status |
| `leads` | Buyer inquiries on listings | Listing + contact info + status |
| `activity_log` | Audit trail | Polymorphic, per-org |
| `comments` | Discussion threads | Polymorphic |

**Commercialization hooks built in from day one:**
- Every table has `organization_id` as a foreign key
- Every table has RLS (Row Level Security) policies scoped to organization
- `user_roles` supports flip-level scoping (e.g. "this contractor manager sees only Flip A and Flip B") even if UI ships later
- JSONB `metadata` columns on `properties`, `flips`, `contractors` for future custom fields

### 2.3 Deliberately deferred to v2+
- Email templates / email sending
- Public investor portal (v1: investors see reports via PDF export only)
- Contractor self-service portal (v1: contractors are data, not users)
- Buyer CRM beyond basic lead capture
- API for third-party integrations
- Mobile-native apps (v1 is mobile-responsive web only)

---

## 3. The Four Pillars (Module Architecture)

The app's primary navigation reflects the four operational teams. Each pillar has a primary surface, but all pillars read from and write to the same underlying Flip.

### 3.1 Pillar 1 — Sourcing
**Owned by:** Property Sourcing team
**Primary job:** Find, underwrite, and acquire profitable flip opportunities

**Core views:**
- **Deal Pipeline** — Kanban view of properties in sourcing stages (lead → viewing → analysis → offer → negotiation → won / lost)
- **Deal Analysis** — underwriting calculator per property: purchase price, est. renovation cost, est. ARV (after-repair value), target margin, timeline assumptions
- **Property Library** — all properties ever evaluated, filterable by outcome (acquired / passed / lost)

**Key interaction:** When a deal is marked "won", the system prompts to create a Flip from the underwriting snapshot — carrying forward budget assumptions, target ARV, and timeline into the Flip's baseline.

### 3.2 Pillar 2 — Project Management
**Owned by:** Project Manager
**Primary job:** Air-traffic-control view across all active flips; owns budget and timeline

**Core views:**
- **Flip Portfolio Dashboard** — one row per active Flip, showing stage, days in stage, budget burn %, timeline variance, blockers
- **Flip Detail Page** — the single "home" for a flip: team, budget summary, timeline, active tasks, recent activity, documents
- **Timeline View (Gantt)** — milestones across all flips, with critical path highlights
- **Budget Tracker** — budgeted vs committed vs actual per flip, drilldown per category

**Key interaction:** Budget Variance Alerts — when actual spend on any category exceeds budget by >10%, the PM sees a flag on the dashboard without having to open each flip.

### 3.3 Pillar 3 — Contractor Management
**Owned by:** Contractor Manager
**Primary job:** Assign, track, pay, and evaluate contractors across flips

**Core views:**
- **Contractor Directory** — all contractors with trade, rate card, past flips, performance score
- **Active Assignments Board** — all currently-contracted scopes of work across all flips, filterable by contractor or trade
- **Payment Queue** — payments due / overdue / paid, grouped by contractor and by flip
- **Contractor Scorecard** — per-contractor history: on-time rate, budget adherence, quality rating, total spend

**Key interaction:** When a PM approves a contractor milestone completion, it moves the payment into the Payment Queue automatically. The Contractor Manager approves/schedules payment without re-entering any data.

### 3.4 Pillar 4 — Sales & Marketing
**Owned by:** Sales & Marketing team
**Primary job:** List, market, and close the sale of completed flips

**Core views:**
- **Listings Board** — all active listings, with platform, price, days on market, lead count
- **Lead Inbox** — buyer inquiries across listings, with status (new / contacted / viewing / offer / closed)
- **Marketing Assets** — photos, floor plans, descriptions per flip, with version history
- **Pricing Intelligence** — comp data + price history per listing

**Key interaction:** When a Flip reaches stage `listing`, the system auto-generates a Listing draft pre-populated with property details, final budget (for cost basis reference, internal only), and photo library from the flip's document vault.

### 3.5 Cross-cutting: Investor Reporting
Not a pillar, but a cross-cutting concern accessible from the main nav.

- **Investor List** — all investors with total committed, total distributed, active flips
- **Flip Capital Stack** — per-flip view of who invested how much on what terms
- **Investor Statement Generator** — produces PDF statements per investor per period, pulling from commitments and distributions data
- **Distribution Planner** — when a flip closes, calculates distributions per investor based on cap structure and marks them as pending payment

---

## 4. v1 Scope (The 90-Day Build)

The v1 goal is simple and ruthless: **replace the Google Sheets chaos, for our team, on our 10+ active flips, within 90 days.** Nothing more.

### 4.1 Must-have for v1

**Foundational:**
- Multi-tenant architecture (even with one tenant)
- Auth + basic RBAC (5 roles: Admin, PM, Sourcing, Contractor Manager, Sales)
- Org settings: customizable flip stages, budget categories, contractor trades
- **Full i18n from day one** (Thai default, English toggle) via `next-intl`
- **Strict monochrome design system** applied consistently across all modules
- **Dark mode** support

**Core workflows — end-to-end:**
1. Add a Property and run a Deal Analysis
2. Convert a won deal into a Flip with a baseline budget and timeline
3. Assign team members and contractors to a Flip
4. Track budget (budgeted → committed → actual) per category per Flip
5. Track tasks and milestones per Flip
6. Upload and organize documents/photos per Flip
7. Record contractor payments (queued → approved → paid)
8. List a completed Flip and capture leads
9. Record investor commitments per Flip and generate per-period statements (PDF)
10. See an all-flip portfolio dashboard as a PM

**Must-have UX:**
- Mobile-responsive (team will use on phones at property sites)
- Fast photo upload from mobile (Supabase Storage, with client-side compression)
- LINE Notify integration for: budget alerts, payment approvals, milestone completions
- Markdown-ish notes on everything (flip, task, contractor)
- Global search across flips, properties, contractors, documents

### 4.2 Explicitly deferred from v1 (YAGNI)

- Public investor portal
- Contractor self-service portal
- In-app messaging (use LINE; comments are internal only)
- Email sending (use Resend in v2; v1 uses LINE + PDF export)
- Automated valuation / comp pulls (v1: manual entry)
- Native mobile apps
- AI features beyond basic search (no AI Coach in v1 — that's a commercial-v2 differentiator)
- Expense receipts OCR
- Multi-currency (THB only in v1)
- Reporting builder / custom dashboards
- Webhooks / public API

### 4.3 Commercialization hooks to build in v1 (2 hours now saves 2 months later)

These are architectural decisions, not features. They don't require UI work in v1 but must be right in the schema and middleware:

1. **Every query is org-scoped via RLS**, not via app-layer filters
2. **All tables have `created_by`, `updated_by`, `created_at`, `updated_at`**
3. **Soft-delete pattern** (`deleted_at` column) on all business-data tables — hard deletes are dangerous at multi-tenant scale
4. **Audit log writes from the start** — even if there's no UI to view it in v1
5. **File storage paths include `organization_id`** — so there's no global photo bucket to refactor
6. **Stripe customer ID and subscription status columns on `organizations`** — null in v1, populated when commercial launch happens
7. **Feature flags table** — so v1 features can be selectively exposed to commercial tenants later

---

## 5. v2 / Commercial Launch Scope (Preview)

Not building yet, but design v1 so these are additive, not breaking changes:

- Self-service tenant signup + Stripe billing (one-time + maintenance, per existing pricing model preference)
- Public investor portal (read-only, per-investor)
- Contractor self-service portal (quote submission, milestone self-report, payment status)
- AI Flip Coach (Claude Sonnet) — underwriting assistance, budget reality-check, timeline risk scoring
- Email notifications (Resend) alongside LINE
- Automated comp data / valuation assistance
- Reporting builder
- Native mobile app (consider only if commercial customers request)
- API / webhooks for Zapier / n8n integrations

---

## 6. Tech Stack

Inherit the ECHO stack unless there's a reason to diverge. There isn't.

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14+, TypeScript, Tailwind, shadcn/ui | Consistent with ECHO; team familiarity |
| Backend | Supabase (Postgres, Auth, Storage, RLS) | Multi-tenancy via RLS is the right primitive here |
| ORM | Prisma | Consistent with ECHO |
| i18n | `next-intl` | Thai-first with English available; SSR-correct; ICU syntax |
| Notifications | LINE Notify (v1), Resend (v2) | Thai team uses LINE; email later |
| File storage | Supabase Storage, org-scoped paths | Photos are central to flipping |
| Background jobs | Trigger.dev | Report generation, payment reminders |
| Hosting | Vercel + Supabase Cloud Singapore | Consistent with ECHO |
| Maps (if needed) | Mapbox GL JS | For property map views; cost scales better than Google |
| Typography | IBM Plex Sans Thai (primary), IBM Plex Mono (numeric/code) | Handles Thai + Latin in a single face; matches ECHO |
| Icons | Lucide React, 1.5 stroke width | Consistent with ECHO |

**Visual language:** Strict monochrome, Attio/shadcn-inspired. See DESIGN_SYSTEM.md for the full palette, typography scale, and component specs. The design is intentionally close to ECHO's so the two products feel like a suite if offered together to Thai real estate businesses.

---

## 7. Key Design Decisions

1. **Flip is the central entity, not Property.** All workflow data hangs off Flip. This is non-negotiable and everything downstream depends on it.
2. **Multi-tenant from day one via RLS.** Not negotiable. This is the single most important architectural decision.
3. **Budget has three states: budgeted, committed, actual.** Committed = contract signed, not yet paid. This prevents the "we didn't know we'd spent that" phenomenon.
4. **Contractors are data in v1, users in v2.** Don't build login flows for them until commercial launch.
5. **Investors are data + PDF outputs in v1, users in v2.** Same reason.
6. **LINE over email for v1 notifications.** Non-negotiable for Thai team usage.
7. **Mobile-responsive, not mobile-native.** Team uses phones at property sites; PWA quality is enough for v1.
8. **Stage definitions are configurable per org.** The operator's stages today are not necessarily what a commercial customer's stages will be.
9. **No AI features in v1.** This is deliberate. AI is a commercial-v2 differentiator. v1 is about replacing sheets.
10. **Soft-delete everything.** Hard deletes are how multi-tenant data gets corrupted.
11. **Thai-first, English-available (i18n from day one).** Thai is the default locale; English is a toggle. Every UI string, every system-generated document (PDF statements, LINE notifications, emails), and every seeded lookup value exists in both languages. Implemented via `next-intl`. Thai strings are authored first; English is translated from Thai — not the other way around. User-entered content is never auto-translated. See DESIGN_SYSTEM.md Section 8 for the full i18n spec.
12. **Monochrome base with semantic state color.** Black, white, and grays for all chrome — navigation, headings, tables, stage pills, role labels, category tags, priority indicators. Color (positive green, warning amber, destructive red) is reserved exclusively for state signals with inherent good/bad directionality: budget variance, timeline slippage, task overdue state, payment outcomes. Categories and stages stay neutral regardless of semantic meaning ("Sold" gets no green; it's a stage, not a celebration). This preserves scan-speed for operational signals while avoiding visual noise from decorative color. See DESIGN_SYSTEM.md Sections 1–2 for the full rules.
13. **IBM Plex Sans Thai as the primary typeface.** Handles Thai, Latin, and mixed-script content in a single face. Loaded via Next.js Google Fonts. Matches ECHO's typography, preserving visual continuity if the operator's products are ever offered as a suite. See DESIGN_SYSTEM.md Section 3.

---

## 8. Open Questions (need answers before build starts)

These are the things that will meaningfully change the build if answered differently. They should be resolved before implementation begins.

1. **Capital stack complexity:** Are investors on each flip on flat-interest terms, equity splits, or waterfalls? A waterfall model requires significantly more data model work than flat interest. What's the actual structure of current deals?

2. **Property sourcing inputs:** How are leads currently sourced — agent referrals, direct owner outreach, auctions, broker networks? This determines whether the sourcing pipeline needs lead-source tracking in v1 or v2.

3. **Contractor payment reality:** Are payments milestone-based, percentage-based, or time-and-materials? The budget tracker's "committed" state depends on this.

4. **Renovation scope definition:** Do you create a fixed Scope of Work document per contractor assignment, or is it more fluid? The data model for contractor_assignments depends on this.

5. **Document volume per flip:** Rough estimate — how many photos + docs per flip? This affects storage architecture and UI patterns (gallery vs list).

6. **Resale channels:** Which listing platforms does the Sales team post to? If these are Thai-specific (DDProperty, Hipflat, Livinginsider, FB), future v2 may want direct integrations.

7. **Multi-property contractor assignments:** Does one contractor sometimes work on multiple flips simultaneously? This affects the Contractor Scorecard and conflict-detection logic.

8. **"Held" / rental pivots:** What happens when a flip decision is reversed and a property becomes a hold/rental instead? Does that exit the system, or is there a "conversion" path? (v1 suggestion: mark Flip as `killed` with reason; property remains.)

---

## 9. Success Criteria for v1

v1 is successful if, 90 days after launch:

- All 10+ current flips are fully migrated off Google Sheets into the system
- All 4 team members use the system as their primary operational surface (not as a secondary record)
- Budget variance is visible to the PM within 24 hours of it occurring (vs. current: discovered at end of flip)
- A new investor statement can be produced in under 5 minutes (vs. current: manual spreadsheet work)
- No critical data lives in Google Sheets anymore — system is the source of truth

If any of these aren't true at 90 days, v1 has failed on its own terms, regardless of how much code was shipped.

---

## 10. Next Steps

1. **Resolve the 8 open questions in Section 8** — without these, schema decisions are guesses
2. **Draft IMPLEMENTATION_PLAN.md** — phased 90-day build plan
3. **Draft DATA_MODEL.md** — full table specs with columns, relationships, RLS policies
4. **Draft DESIGN_SYSTEM.md** — reuse ECHO's where applicable, extend for flipping-specific patterns
5. **Start the build, one pillar at a time, in this order:** Sourcing → Project Management → Contractor Management → Sales & Marketing → Investor Reporting
