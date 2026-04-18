# IMPLEMENTATION_PLAN.md

## Property Flipping Management System — 90-Day Build Plan
### Milestone-by-milestone roadmap. Build in this order. Don't skip ahead.

> **Reading this doc:** Each milestone is independently shippable, has a clear demo state, and unblocks the next one. The order matters — building M4 before M3 means refactoring. Every milestone ends with a **demo script** (the thing you show yourself before calling it done) and **test criteria** (the automated checks that must pass). Estimated hours are for vibe-coded work with Claude Code; double them if you're writing by hand.

---

## 1. Philosophy of this plan

Five principles that drive the sequencing:

1. **Foundation before features.** Auth, multi-tenancy, RLS, and i18n must be right at M0–M1. Building features on a wrong foundation means ripping them out later.

2. **One pillar at a time, end-to-end.** Rather than building "all CRUD for all entities first, then all forms," each milestone completes one pillar (or one cross-cutting concern) from database through UI. You should be able to demo it.

3. **Most painful Google Sheets first.** Google Sheets pain isn't evenly distributed. Budget tracking + contractor payments are where the chaos lives today. They come before nice-to-haves like the portfolio dashboard.

4. **RLS tested early, not late.** A cross-tenant leak test runs by end of M1. If RLS is wrong, we find out on day 7, not day 70.

5. **Every milestone is shippable.** You can stop at any milestone and have a useful system. Stopping at M4 means you have a working flip + budget tracker, which already beats your current Google Sheets.

---

## 2. Milestone overview

| ✓ | # | Milestone | Goal | Est. hours | Cumulative | Week |
|---|---|---|---|---|---|---|
| [x] | M0 | Bootstrap | Empty app running on Vercel, connected to Supabase | 8–12 | 12 | 1 |
| [x] | M1 | Foundation | Auth + multi-tenancy + i18n + app shell | 20–30 | 42 | 1–2 |
| [x] | M2 | Properties & Deal Analysis | Add properties, run underwriting | 16–24 | 66 | 2–3 |
| [x] | M3 | Flips (core) | Create flips, flip detail page, stages, team | 20–28 | 94 | 3–4 |
| [x] | M3.5 | Invitations & Members | Admin-issued invite links + members page | 4–6 | 100 | 4 |
| [x] | M3.6 | Pivot / Re-underwriting | Float re-underwrite (spread math) + pivot-to-transfer + revive + remove member | 6–8 | 108 | 4 |
| [ ] | M4 | Budget | Three-state budget tracking, categories, variance | 20–28 | 136 | 4–6 |
| [ ] | M5 | Contractors (directory + assignments) | Contractor library + scope of work per flip | 20–28 | 150 | 6–7 |
| [ ] | M6 | Contractor Payments | Milestones, T&M entries, payment queue | 24–32 | 182 | 7–9 |
| [ ] | M7 | Tasks & Timeline | Tasks per flip, milestone timeline, due dates | 12–18 | 200 | 9 |
| [ ] | M8 | Investors & Capital | Investor directory, commitments per flip | 16–24 | 224 | 10 |
| [ ] | M9 | Distributions & Statements | Payouts + PDF statement generation | 16–24 | 248 | 11 |
| [ ] | M10 | Listings & Leads | Sales pillar — list flips, capture buyer inquiries | 16–20 | 268 | 12 |
| [ ] | M11 | Portfolio Dashboard & Polish | PM dashboard, LINE notifications, mobile polish | 20–28 | 296 | 13 |
| [ ] | M12 | Data Migration | Import 10+ current flips from Google Sheets | 12–20 | 316 | 13 |

**Total:** ~220–316 vibe-coded hours over ~13 weeks (90 days). Budget 1.5–2x if you're mixing with other work — which, given ECHO and consulting, you are.

**Realistic solo pace:** ~20–25 hours/week of focused build time = 12–14 weeks to v1. This aligns with the 90-day target if nothing else competes.

---

## 3. M0 — Bootstrap

**Goal:** Empty Next.js app deployed to Vercel, connected to Supabase Singapore, with all dev tooling working.

**Duration:** 1–2 days (~8–12 hours)

### 3.1 Deliverables

Everything in TECH_STACK.md §20 (Bootstrap Checklist). Specifically:

- [x] Next.js 15 app with TypeScript, Tailwind, App Router, `/src` dir
- [x] All dependencies installed per TECH_STACK.md §1
- [x] Biome configured per CONVENTIONS.md §16
- [x] lefthook hooks running on pre-commit and pre-push
- [ ] Supabase project created (Singapore region, Pro tier)
- [x] Prisma initialized, pointed at Supabase
- [x] `/src/lib/env.ts` with zod validation, all env vars defined
- [x] shadcn/ui initialized with customized tokens from DESIGN_SYSTEM.md
- [x] Fonts loaded (IBM Plex Sans Thai + IBM Plex Mono) via `next/font/google`
- [x] Tailwind config has full design token theme (colors, spacing, typography per DESIGN_SYSTEM.md)
- [x] `src/proxy.ts` skeleton in place (no auth yet, just locale resolution; Next 16 renamed `middleware.ts` → `proxy.ts`)
- [x] Deployed to Vercel with preview deployments working

### 3.2 Test criteria

- [x] `pnpm dev` starts on localhost:3000, home page loads in Thai
- [x] `pnpm build` succeeds with no TS errors
- [x] `pnpm biome check` passes
- [x] `git commit` triggers lefthook, runs biome + tsc, blocks on failure
- [x] Pushing to a branch creates a Vercel preview deployment
- [x] `.env.local` parsed successfully by zod (intentionally break one to verify the fail-loud behavior)

### 3.3 Demo script

Open `https://flipping-system.vercel.app` → see a "Hello" page in Thai (IBM Plex Sans Thai) with the monochrome design tokens applied. Switch to `/en` → same page in English. Inspect DevTools → CSS variables from `--color-background` to `--color-destructive` all defined. Build logs show no warnings.

### 3.4 What's explicitly NOT in M0

- Any auth flow (login page is just a placeholder)
- Any database table beyond what Supabase auto-creates
- Any Prisma migrations applied
- Any feature code in `/src/features`

### 3.5 Done when

You can point Claude Code at the project, tell it "add a new shadcn component," and it does so correctly using our tokens without guessing.

---

## 4. M1 — Foundation (Auth + Multi-tenancy + i18n)

**Goal:** A user can sign up, log in, belong to an organization, and see an authenticated app shell with sidebar/topbar. All empty, but structurally complete.

**Duration:** 5–7 days (~20–30 hours)

### 4.1 Deliverables

**Database (SQL migrations applied in order):**
- [x] `organizations` table (DATA_MODEL.md §2.1)
- [x] `users` table (DATA_MODEL.md §2.2)
- [x] `roles` table with seeded 5 system roles (DATA_MODEL.md §2.3)
- [x] `user_roles` junction (DATA_MODEL.md §2.4)
- [x] `activity_log` table + trigger function (DATA_MODEL.md §11.1, §14.2)
- [x] `feature_flags` table (DATA_MODEL.md §12)
- [x] Helper function `user_org_ids()` (DATA_MODEL.md §15.1)
- [x] RLS enabled on all 6 foundation tables with policies from DATA_MODEL.md §15.3–15.5
- [x] Seed function: `seed_organization_roles(org_id)` inserts 5 system roles (flip_stages + budget_categories deferred to M2/M4 when those tables exist)

**Auth flow:**
- [x] `/login` page with email + password
- [x] `/signup` page that creates both auth user + `users` row + `organizations` row + `user_roles` row (as admin) in a transaction
- [ ] `/forgot-password` and `/reset-password` (magic link flow via Supabase) — **DEFERRED: 4 internal users; low priority until commercial**
- [x] Logout action
- [x] Auth redirects: unauthenticated → `/login`; authenticated on `/login` → `/dashboard` (via layout checks, not proxy middleware)

**i18n:**
- [x] `/messages/th/common.json` and `/messages/en/common.json` with foundation strings (nav, buttons, auth forms)
- [ ] Locale switcher in user menu — **DEFERRED: URL-based switching (`/en/*`) works; UI toggle is UX polish**
- [ ] `users.locale` persisted; changing locale in UI updates the row — **DEFERRED: blocked by locale switcher**
- [x] Buddhist Era date formatter helper (CONVENTIONS.md §13.5)
- [x] Currency formatter helper (CONVENTIONS.md §13.6)
- [x] `getLocalizedName` helper for lookup tables (CONVENTIONS.md §13.7)

**App shell:**
- [x] `app/[locale]/(auth)/layout.tsx` — minimal layout for auth pages
- [x] `app/[locale]/(app)/layout.tsx` — sidebar + topbar + main content area
- [x] Sidebar with nav items (stubs — most routes 404 at this stage): Dashboard, Sourcing, Flips, Contractors, Investors, Listings, Settings
- [x] Topbar with org name, user info, logout button
- [x] Mobile: bottom tab bar replaces sidebar at ≤768px
- [ ] Dark mode toggle working; theme persisted to `users.metadata.theme` — **DEFERRED: `prefers-color-scheme` auto-detection works; manual toggle is UX polish**

**Server primitives (used everywhere):**
- [x] `/src/server/db.ts` — Prisma 7 client singleton with PrismaPg adapter (soft-delete `$extends` deferred to M2 when queries need it)
- [x] `/src/server/supabase/server-client.ts` — server Supabase client (CONVENTIONS.md §6.1)
- [x] `/src/server/supabase/auth.ts` — `getCurrentUser`, `requireAuth`, `getActiveOrgId` (CONVENTIONS.md §6.2)
- [x] `/src/server/shared/activity-log.ts` — `logActivity` helper
- [x] `/src/lib/i18n.ts` — locale type, supported locales, `getLocalizedName`
- [x] `/src/types/common.ts` — `ActionResult` discriminated union (CONVENTIONS.md §7.2)

**Primitive UI components:**
- [x] `<Pill>` (neutral + semantic variants per DESIGN_SYSTEM.md §5.4)
- [x] `<Currency>` — formatted THB display, tabular nums, locale-aware
- [x] `<DateDisplay>` — formatted date, Buddhist Era in Thai locale
- [x] `<Variance>` — number + percent with semantic color per directionality
- [x] `<EmptyState>` — centered text + CTA button
- [x] `<SkeletonTable>` — loading placeholder
- [x] `<ConfirmDeleteDialog>` — destructive action confirmation

### 4.2 Test criteria

**Automated:**
- [x] `pnpm tsc --noEmit` passes
- [x] `pnpm biome check` passes
- [ ] Unit tests: all formatter helpers (currency, date, Buddhist Era edge cases) — **DEFERRED to M2: formatters are written and typed; vitest tests added when M2 exercises them**
- [ ] Unit tests: `ActionResult` type narrowing works correctly — **DEFERRED: type is defined and used; formal test added with M2**
- [ ] Playwright E2E: signup → creates org → lands on empty dashboard → logout → login with same creds → back on dashboard — **DEFERRED: tested manually; Playwright wiring in M2 when there's more to test**
- [ ] Playwright E2E (**critical**): cross-tenant leak test — **DEFERRED to end of M2: needs org-scoped data URLs (property pages) to probe meaningfully**
  1. User A signs up, creates Org A
  2. User B signs up, creates Org B
  3. Logged in as User A, directly hit URLs that should only return Org B data (once we have any)
  4. Assert 404 or empty response, never Org B data

**Manual:**
- [x] Signup form renders in Thai by default
- [ ] Toggle to English → form renders in English, URL changes to `/en/signup` — **DEFERRED: URL-based `/en/signup` works; no locale switcher UI yet**
- [x] Signup with email + password → immediately logged in, lands on dashboard (requires Supabase email confirmation disabled)
- [x] Refresh page → still logged in
- [x] Logout → redirects to `/login`, hitting `/dashboard` redirects to `/login`
- [ ] Dark mode toggle → instant, persists across sessions — **DEFERRED: `prefers-color-scheme` works; manual toggle is UX polish**
- [x] Mobile view (Chrome DevTools, iPhone 14 Pro) → bottom tab bar visible, sidebar hidden

### 4.3 Demo script

Sign up as a new user → see the sidebar with your org name → toggle language → toggle theme → log out → log back in. Show the activity_log in Supabase Studio: rows for `created` on organizations, users, user_roles. Show the cross-tenant leak test passing. Show Sentry (if configured) showing zero errors.

### 4.4 What's explicitly NOT in M1

- Any business entity tables (properties, flips, contractors) — those start in M2
- Any dashboard content (the dashboard is just "Hello {user.name}")
- Settings page (stub only)
- Org switching (v1 assumes one org per user; commercial v2 adds multi-org support)
- Email verification flow (uses Supabase default for now; tighten in v1.5)

### 4.5 Done when

- A new user can sign up and their org, role, and user_roles rows exist
- RLS prevents cross-tenant reads (proven by test)
- The app shell renders in both Thai and English, both light and dark modes
- `getActiveOrgId()` works reliably in any Server Component or Server Action
- `logActivity` writes to `activity_log` on any mutation

---

## 5. M2 — Properties & Deal Analysis (Sourcing Pillar, Part 1)

**Goal:** The Sourcing team can add properties, run deal analyses on them, and mark deals as pursue/pass. Pipeline view (Kanban) shows pre-flip pipeline stages.

**Duration:** 4–5 days (~16–24 hours)

### 5.1 Deliverables

**Database:**
- [x] `properties` table with RLS — reworked from DATA_MODEL.md §3.1: removed address requirement, added `listing_name`, `project_id`, `contact_id`, `asking_price_thb`, `price_remark`, `listing_url`, `floor_level`, `sourcing_status` pipeline field
- [x] `deal_analyses` table (DATA_MODEL.md §4.1) with RLS
- [x] `flip_stages` table (DATA_MODEL.md §3.3) with RLS + seeded 9 default stages
- [x] `contacts` table with RLS — reusable contact records (seller/agent/owner/developer) linked across properties
- [x] `projects` table with RLS — canonical project/development names for comp analysis, unique per org
- [x] `seed_organization_flip_stages()` function for new org creation

**Feature: `/src/features/sourcing`**
- [x] Queries: `listProperties`, `getProperty`, `listContacts`, `getContact`, `listProjects`, `getProject`, `listPickerOptions` (project + contact name lists for the combobox)
- [x] Actions: `createProperty` (auto-creates project + contact), `updateProperty`, `createDealAnalysis`, `updateDealAnalysis` (recomputes totals), `deleteDealAnalysis` (soft), `recordDealDecision`, `createContact`, `updateContact`, `createProject`, `updateProject`, `updateSourcingStatus`
- [x] Validators: `propertySchema`, `updatePropertySchema`, `dealAnalysisSchema`, `updateDealAnalysisSchema`, `dealDecisionSchema`, `createContactSchema`, `updateContactSchema`, `createProjectSchema`, `updateProjectSchema`, `computeDealFields`
- [x] Components:
  - [x] `<PropertyLibraryTable>` — thumbnails + project, type, specs, asking price, sourcing status columns
  - [x] `<PropertyDialog>` — unified create + edit (4 sections: Basic incl. thumbnail upload, Specs, Pricing, Contact) with combobox pickers for project/contact
  - [x] `<DealAnalysisForm>` — underwriting calculator with ฟลิบลอย/โอนเข้า toggle + live profit/margin/ROI computation panel; supports both create and edit modes
  - [x] `<DealAnalysisCard>` — analysis card with label, edit/delete/pursue/pass actions
  - [x] `<DealPipelineKanban>` — drag-and-drop Kanban across 8 sourcing status columns (dnd-kit + DragOverlay); view toggle on /sourcing/properties
  - [x] `<ContactTable>`, `<ContactEditForm>`, `<CreateContactDialog>` — contacts directory CRUD
  - [x] `<ProjectTable>`, `<ProjectEditForm>`, `<CreateProjectDialog>` — projects directory CRUD
  - [x] `<SourcingSubNav>` — sub-nav bar: อสังหาฯ | ผู้ติดต่อ | โครงการ
  - [x] `<PropertyDetailPage>` — property info + deal analyses list + inline analysis form + edit dialog trigger

**Shared form primitives (built during M2):**
- [x] `<NumberInput>` — locale thousand separators, raw digits on focus (used for all numeric + currency fields)
- [x] `<ComboboxPicker>` — searchable dropdown with inline "create new" option (project/contact pickers)
- [x] `<ThumbnailUpload>` — direct-to-Supabase-Storage upload, preview, hover-to-replace

**Routes:**
- [x] `/sourcing` → redirects to `/sourcing/properties`
- [x] `/sourcing/properties` → property library (table / Kanban toggle)
- [x] `/sourcing/properties/[propertyId]` → property detail page with deal analyses
- [x] `/sourcing/contacts` → contact directory
- [x] `/sourcing/contacts/[contactId]` → contact detail with linked properties
- [x] `/sourcing/projects` → project directory
- [x] `/sourcing/projects/[projectId]` → project detail with properties in project

**Storage:**
- [x] Supabase Storage bucket `property-thumbnails` — public, 5MB limit, image MIME only; RLS allows authenticated insert, owner-scoped update/delete; path pattern `{orgId}/{uuid}.{ext}`

**i18n:** `/messages/{th,en}/sourcing.json` — [x] done, includes contact types, sourcing statuses, deal-analysis label/delete, sub-nav, contacts/projects directory, thumbnail messages, view toggle

**Schema additions made during M2 (post-initial migration):**
- [x] `deal_analyses.label` VARCHAR(100) — user-facing analysis name
- [x] `deal_analyses.other_cost_thb` NUMERIC(14,2) NOT NULL DEFAULT 0 — catch-all cost bucket used in totals for both flip types
- [x] `properties.thumbnail_path` TEXT — path into `property-thumbnails` bucket
- [x] Contact type cleanup: `seller` merged into `owner` (DB rows migrated, enum now `owner | agent | developer | other`)

### 5.2 Test criteria

**Automated:**
- [ ] Unit tests: deal analysis computed fields (`total_cost`, `est_profit`, `est_margin_pct`, `est_roi_pct`) — edge cases: zero ARV, negative profit, very high ROI — **DEFERRED to when Playwright + vitest are wired**
- [ ] Integration test: `createDealAnalysis` creates the row, logs activity, recomputes totals correctly — **DEFERRED**
- [ ] Playwright: Sourcing team user creates property → runs analysis → marks as "pursue" — **DEFERRED to M3/M4 when more stable flows exist**

**Manual:**
- [x] Create a property with Thai listing name, project, specs → renders correctly
- [x] Run a deal analysis → live totals update as inputs change
- [x] Edit a property, edit a deal analysis → changes persist and re-render
- [x] Delete a deal analysis → soft-deleted, no longer appears on detail page
- [x] Pursue / pass decision buttons → update analysis and pill re-colors
- [x] Thumbnail upload → image stored in Supabase Storage, visible in table + kanban + detail header
- [x] Pipeline Kanban → drag a card between columns → DB updates and card stays in new column
- [x] Contact directory: view all contacts, see linked properties, add/edit contacts directly
- [x] Project directory: view all projects, see linked units, add/edit projects directly

### 5.3 Demo script

Open `/sourcing/properties` → see 8 seeded Thai properties across 3 projects (ลุมพินี ดินแดง, บ้านกลางเมือง สาทร, ไอดีโอ โมบิ). Click "เพิ่มอสังหาฯ" → fill: listing name "ทาวน์เฮ้าส์สาทร #9", project "บ้านกลางเมือง สาทร-ตากสิน" (auto-links existing project), type ทาวน์เฮ้าส์, 3 bed / 3 bath / 150 sqm / 3 floors, asking ฿6.5M, price remark "ค่าโอนคนละครึ่ง", contact: agent "สมชาย ใจดี" 081-234-5678. Save → lands on property detail. Fill deal analysis: purchase 6.5M, reno 1.2M, ARV 9.5M, 90 days → live panel shows ~19% margin. Save → analysis appears in list above. Click back → property in library table with project name and ฿6.5M asking price.

### 5.4 What's explicitly NOT in M2

- Converting a pursued deal into a Flip — that's M3
- **Property photo gallery** — single thumbnail per property IS in M2 (landed late in M2 because the pipeline Kanban needed visuals to be scannable); full gallery with multiple images + reordering stays in M11 with document upload everywhere
- Map view (Mapbox deferred)
- Property search / full-text filtering (v1.5)
- Project comp analysis (data collection starts in M2 via projects table; analysis UI is v1.5)

### 5.5 Done when

- The Sourcing team's full workflow is usable: add property → analyze → decide → see pipeline status
- Contact and project directories let the team manage their agent/seller contacts and track developments
- 10+ properties can be created, 20+ deal analyses run without perf issues
- All Thai text renders correctly; English toggle works end-to-end

---

## 6. M3 — Flips Core

**Goal:** A pursued deal converts to a Flip. The Flip detail page exists. Flips have stages, team assignments, and baseline budget numbers (but not yet the budget-lines detail — that's M4).

**Duration:** 5–7 days (~20–28 hours)

### 6.1 Deliverables

**Database:**
- [x] `flips` table (DATA_MODEL.md §3.2) with RLS
- [x] `flip_team_members` table (DATA_MODEL.md §3.4) with RLS
- [x] `flip_code_counters` table — atomic per-(org, year) allocator for `FLIP-YYYY-###` codes (DATA_MODEL.md §3.5, added during M3)
- [x] `flip_portfolio_dashboard` view — M3-basic version without budget/task aggregates; extend in M4 and M7

**Feature: `/src/features/flips`**
- [x] Queries: `listFlips` (filterable all/active/closed), `getFlipById`, `listFlipStages`, `listOrgUsers`
- [x] Actions: `createFlip` (from deal analysis; carries baseline numbers; atomic code allocation), `updateFlip`, `moveFlipToStage` (rejects terminal stages; `killed` must go through killFlip), `killFlip`, `assignTeamMember`, `removeTeamMember`
- [x] Validators: `createFlipSchema`, `updateFlipSchema`, `killFlipSchema`, `assignTeamMemberSchema`, `removeTeamMemberSchema`, `moveFlipToStageSchema`
- [x] Components:
  - [x] `<FlipListTable>` + `<FlipsPageClient>` (filter tabs all/active/closed)
  - [x] `<FlipDetailHeader>` — code, name, stage pill, stage change dropdown, kill action
  - [x] `<FlipStageSelect>` — dropdown with confirmation for terminal stages; locks on sold/killed
  - [x] `<FlipTeamPanel>` — list of team members + assign/remove dialog
  - [x] `<CreateFlipFromDealDialog>` — invoked from Sourcing when a deal is marked pursue + "Convert to Flip"
  - [x] `<KillFlipDialog>` — destructive confirmation with reason dropdown
  - [x] `<FlipOverviewPanel>` — baseline vs. actuals side-by-side, with M4/M7/M11 placeholders

**Routes:**
- [x] `/flips` → flip list table with filter tabs
- [x] `/flips/[flipId]` → flip detail (header + overview panel + team panel)
- [x] `/flips/[flipId]/team` → team management sub-route

**Integration with M2:**
- [x] Deal analysis card gets a "Convert to Flip" button (shown only when `decision = 'pursue'` and no flip yet)
- [x] Dialog pre-populates the flip name from the property listing name
- [x] On creation, `deal_analyses.flip_id` is set to link them; card shows "→ flip" link after

**i18n:** [x] `/messages/{th,en}/flips.json`

### 6.2 Test criteria

**Automated:**
- [ ] Integration test: `createFlip` from deal analysis correctly copies baseline numbers, sets `deal_analyses.flip_id`, logs activity, creates in correct stage
- [ ] Integration test: `killFlip` sets `killed_at` + `killed_reason`, moves flip to `killed` stage, logs activity
- [ ] Integration test: `moveFlipToStage` rejects moves from `sold` or `killed` stages (terminal)
- [ ] Playwright: full flow — pursue a deal → convert to flip → assign 2 team members → move stage → kill it

**Manual:**
- [ ] Flip code auto-generation (`FLIP-2026-001`, `FLIP-2026-002`) — sequential per org
- [ ] Flip detail page renders in both locales, both themes
- [ ] Team member assignment → user appears in list immediately (revalidation works)
- [ ] Kill flip → confirmation modal requires reason selection → flip moves to killed stage, appears greyed out in lists

### 6.3 Demo script

Take the "pursue" deal from M2's demo → convert to Flip. See FLIP-2026-001 created, stage = `acquiring`. Assign yourself as PM lead and a sourcing teammate as contributor. Change stage to `renovating`. Show the activity log has created + stage_changed + team_assigned entries.

### 6.4 What's explicitly NOT in M3

- Budget line items (M4)
- Contractor assignments (M5)
- Tasks or milestones (M7)
- Documents / photos (M11)
- The portfolio dashboard (M11) — just a basic list view in M3

### 6.5 Done when

- [x] A full deal-to-flip workflow is usable end-to-end
- [x] A flip can be created, updated, staged through the lifecycle, killed
- [x] The flip detail page is the "home" for a flip (even if most panels are placeholders)
- [x] 10+ flips can coexist, each on a different stage, without conflicts

### 6.6 M3 deferred items (carried forward)

- **Automated/Playwright tests** (§6.2) — not wired; test harness still pending from M1.
- **"Edit flip" form** — `updateFlip` action exists but there's no UI yet to edit name, actual purchase price, acquired/listed/sold dates, notes. Overview panel always shows "—" for actuals. Schedule before M4 if actuals are needed during budget entry.
- **Full property photo gallery** — single thumbnail only; M11.
- **Expanded `flip_portfolio_dashboard` view** — no budget/task aggregates yet (M4 + M7 to extend).

---

## 6.5.1 M3.5 — Invitations & Members

**Goal:** Additional users can join an existing org via admin-issued invite links. Settings/members page lets admins invite, revoke, remove.

**Duration:** ~half a day (~4–6 hours). Built immediately after M3 once team assignment surfaced the "only one user exists" gap.

### 6.5.1.1 Deliverables

**Database:**
- [x] `org_invitations` table (DATA_MODEL.md §2.5) with RLS — admin-issued, SHA-256 hashed tokens, email-bound, 7-day expiry, soft-delete
- [x] `get_invitation_by_hash(token_hash)` — SECURITY DEFINER function; anon-callable; returns public invitation fields if valid
- [x] `accept_invitation(token_hash, full_name)` — SECURITY DEFINER function; authenticated-only; atomically validates invite, updates user's name, creates `user_roles` row, marks accepted, logs activity

**Feature: `/src/features/members`**
- [x] Queries: `listMembers`, `listInvitations`, `listOrgRoles`, `getInvitationByToken`
- [x] Actions: `createInvitation` (admin-only; generates hashed token), `revokeInvitation` (admin-only), `removeMember` (admin-only; refuses self-removal + last-admin removal), `acceptInvitation` (public; Supabase signUp → rpc('accept_invitation'))
- [x] Validators: `createInvitationSchema`, `revokeInvitationSchema`, `removeMemberSchema`, `acceptInvitationSchema`
- [x] Helpers: `isOrgAdmin()` at `src/server/shared/require-admin.ts`; `generateInviteToken()`/`hashInviteToken()` at `src/features/members/lib/invite-token.ts`
- [x] Components: `<MembersPageClient>` (tabs: members + pending invites), `<InviteMemberDialog>` (shows link once), `<AcceptInvitationForm>`

**Routes:**
- [x] `/settings/members` → admin-gated member management (non-admins see members list only)
- [x] `/invite/[token]` → public accept page (new-user signup only)

**Nav:** [x] "Members" item added to sidebar

**i18n:** [x] `/messages/{th,en}/members.json`

### 6.5.1.2 Design decisions (locked 2026-04-18)

1. **Tokens hashed, not raw.** SHA-256 in DB; raw only in the invite URL. Leaked DB backup can't replay.
2. **Email strictly locked.** Signup must use the exact invitation email. No per-invite toggle.
3. **Admin-only.** Only `admin` role can invite/revoke/remove. Admins can invite anyone as any role (no "can't invite higher than self" rule).
4. **New-user-only accept flow.** Existing-account-joins-another-org is out of scope — see `memory/project_multi_org_gap.md`.
5. **Expiry 7 days**, admin-revocable anytime via soft-delete. Expired invites stay in the list (marked "Expired") so admins can revoke/re-issue.
6. **Remove member safety:** can't remove self; can't remove the last admin; soft-deletes the `user_roles` row (existing `flip_team_members` rows stay for history).

### 6.5.1.3 What's explicitly NOT in M3.5

- **Existing-user accept flow** (logged-in user claiming a second invite) — deferred with multi-org support.
- **Org switcher UI** — deferred.
- **Email delivery.** Links are generated in-app; admin pastes into LINE/email manually. No transactional email service wired.
- **Role permission enforcement** beyond `admin`. See `memory/project_role_permissions_gap.md`.

---

## 6.5.2 M3.6 — Pivot / Re-underwriting + Revive + Remove Member

**Goal:** Handle mid-flight flip economics honestly. A float-flip contract expiring must offer re-underwriting (spread math, extension fees) or a pivot-to-transfer-in (full-ARV math with added capital). Killed flips need an undo. Members need a way to be removed from the org. All shipped as a single bundle immediately after M3.5 because each piece surfaced real gaps from earlier milestones.

**Duration:** ~6–8 hours.

### 6.5.2.1 Deliverables

**Database:**
- [x] `flip_revisions` table (DATA_MODEL.md §3.6) — per-flip dated snapshots of re-underwriting events. Stores both the full inputs (sunk + new capital + targets) and the computed totals for history.
- [x] `flips.flip_type` column (`float_flip` | `transfer_in`, default `float_flip`), backfilled from the originating deal analysis. Pivots flip this column to `transfer_in` so subsequent re-underwrites use the right profit math.
- [x] Additional revision fields: `original_contract_price_thb`, `new_marketing_budget_thb`, `new_commission_thb`, `new_additional_deposit_thb`, `new_additional_expense_thb` — for float-flip-specific inputs (SPA spread + contract-extension line items).
- [x] Extended `chk_flips_killed_reason` CHECK to include `contract_expired` (float-flip walkaway).

**Actions (`/src/features/flips/actions`):**
- [x] `createFlipRevision` — atomic: allocates next `revision_number`, computes totals via a mode-specific helper, inserts the revision, updates `flips.baseline_*` to reflect the new plan, flips `flip_type` on pivot, logs activity.
- [x] `reviveFlip` — undo a kill. Clears `killed_at` / `killed_reason`, moves to a user-chosen non-terminal stage, logs activity.
- [x] `removeMember` (in `/src/features/members/actions`) — admin-only; refuses self-removal and last-admin removal; soft-deletes the `user_roles` row.

**Compute modes** (`computeFlipRevisionTotals` in `validators/flip-schemas.ts`):
- `float_reunderwrite` — profit = (new sale price − SPA contract price) − total reno − total marketing − commission − other − additional expense. Capital deployed = deposit + reno + marketing + commission + other + additional deposit + additional expense. The additional deposit is refundable on success, so counts in capital-at-risk but NOT in cost.
- `transfer_reunderwrite` — profit = revised ARV − total capital deployed. Standard full-ARV math.
- `pivot_to_transfer_in` — same full-ARV math; collects remaining property cost + transfer fees (cash/loan split) + loan origination fields the re-underwrite doesn't need.

**UI:**
- [x] `<ReUnderwriteDialog>` — branches on flip_type. Float variant shows SPA price + new sale price + extension line items (additional deposit/expense with hints). Transfer variant uses ARV + standard additions. Live-computed summary + walk-away-vs-continue comparison panel.
- [x] `<PivotToTransferInDialog>` — shown only on float flips. Collects sunk + transfer-acquisition capital; shows walk-away vs pivot comparison.
- [x] `<ReviveFlipDialog>` — picks a non-terminal stage to return to; `killed` and `sold` are excluded from the target list.
- [x] `<FlipRevisionsPanel>` — history list below the team panel; shows each revision's rollups and type.
- [x] FlipDetailHeader buttons gated by state: `Re-underwrite` always (when not terminal); `Pivot (buy-in)` only for float_flip; `Revive` only on killed flips; `Kill` hidden on terminal.
- [x] Members page gets a trash-icon column for removing other members (admin-only, hidden for self).

**Overview panel polish:**
- [x] `กำไรเป้าหมาย / Target profit` row computed from `ARV × margin% / 100`, colored green (`text-positive`) when ≥ 0, red (`text-destructive`) when < 0. Margin % row also colored.

**i18n:** [x] namespaces restructured — `flips.revisionShared` for cross-mode labels, `flips.reunderwrite` and `flips.pivot` for each variant, `flips.revisions` for the history panel. `flips.kill.reasons.contract_expired` added.

### 6.5.2.2 What's explicitly NOT in M3.6

- **Auto-fill of sunk costs** in the revision dialogs. Intentionally manual until M4 ships actuals tracking — see `memory/project_post_m4_autofill.md`.
- **Removing a revision / undoing a pivot.** Revisions are append-only history; if a revision was wrong, add a new correcting revision.
- **Multi-revision-per-session workflow.** One revision at a time; the flip's `baseline_*` columns always reflect the latest.
- **Budget-line synchronization.** After a pivot, M4's budget categories don't auto-adjust. When M4 lands, we'll need to decide how baseline changes propagate to budget lines.

### 6.5.2.3 Done when

- [x] A float flip with an expiring contract can be re-underwritten with the correct spread math (not full-ARV).
- [x] The same float flip can alternatively pivot to transfer-in; subsequent re-underwrites use transfer math.
- [x] Each revision is preserved with its inputs, computed totals, and who/when.
- [x] A killed flip can be revived to a chosen active stage.
- [x] An admin can remove any other member (with the two safety guards).
- [x] Flip overview shows target profit in both ฿ and %, colored by sign.

---

## 7. M4 — Budget

**Goal:** Full three-state budget tracking (budgeted / committed / actual) per flip, per category. Variance visible. This is the feature that replaces the most painful Google Sheets.

**Duration:** 5–7 days (~20–28 hours)

### 7.1 Deliverables

**Database:**
- [ ] `budget_categories` table (DATA_MODEL.md §5.1) with RLS — seed the 15 default categories (Thai + English) into the org seed function
- [ ] `budget_lines` table (DATA_MODEL.md §5.2) with RLS (`contractor_assignment_id` FK nullable; we won't wire it until M5)
- [ ] `flip_budget_summary` view (DATA_MODEL.md §13.1)
- [ ] `category_budget_summary` view (per-flip per-category breakdown)
- [ ] Extend `flip_portfolio_dashboard` view to include budget aggregates

**Feature: `/src/features/budget`** (cross-cutting, used by flips primarily)
- [ ] Queries: `listBudgetLines`, `getBudgetLineById`, `getFlipBudgetSummary`, `listBudgetCategories`, `getCategoryBreakdown`
- [ ] Actions: `createBudgetLine`, `updateBudgetLine` (can update any of the three amounts independently), `deleteBudgetLine`, `createBudgetCategory`, `updateBudgetCategory`
- [ ] Validators: `budgetLineSchema`, `budgetLineUpdateSchema`, `budgetCategorySchema`
- [ ] Components:
  - [ ] `<BudgetTable>` — per-flip table of budget lines, grouped by category, with category subtotals + grand total
  - [ ] `<BudgetLineRow>` — inline-editable row (click to edit budgeted/committed/actual amounts)
  - [ ] `<AddBudgetLineDialog>` — add a new line with category selection
  - [ ] `<BudgetVarianceCard>` — summary card: total budgeted / committed / actual / variance with semantic color per DESIGN_SYSTEM.md §2.2
  - [ ] `<BudgetBurnBar>` — horizontal progress bar for budget utilization
  - [ ] `<CategoryBreakdownChart>` — simple bar representation per category (no library; CSS widths are fine)

**Routes:**
- [ ] `/flips/[flipId]/budget` → budget page (BudgetTable + BudgetVarianceCard + BudgetBurnBar)
- [ ] `/settings/budget-categories` → manage org-level budget categories (Admin only)

**Integration with M3:**
- [ ] Flip detail page gets a "Budget" tab linking to `/flips/[flipId]/budget`
- [ ] Flip detail header shows variance pill (uses `flip_budget_summary` view)

**i18n:** `/messages/{th,en}/budget.json`

### 7.2 Test criteria

**Automated:**
- [ ] Unit tests: variance calculation edge cases (zero budgeted, negative variance, very large overruns)
- [ ] Unit tests: `budgetLineSchema` validation (amounts must be non-negative, category required)
- [ ] Integration test: updating any of the three amounts triggers the view to recompute correctly
- [ ] Integration test: deleting a budget line (soft delete) removes it from totals
- [ ] Playwright: create flip → add 5 budget lines across 3 categories → update actuals → see variance update live → variance pill on flip detail page matches

**Manual:**
- [ ] Inline editing feels fast (no full-page reload on save)
- [ ] Negative variance (under budget) shows in positive green per semantic color rules
- [ ] 10%+ over shows in destructive red
- [ ] Category subtotals update immediately
- [ ] Dark mode / light mode — no visual regressions

### 7.3 Demo script

On FLIP-2026-001, add budget lines:
- Electrical (Budgeted 150k / Committed 150k / Actual 150k)
- Kitchen (Budgeted 300k / Committed 280k / Actual 290k)
- Bathroom (Budgeted 200k / Committed 220k / Actual 245k)
- Contingency (Budgeted 150k / Committed 0 / Actual 0)

Total budgeted 800k / actual 685k → -14% variance (under budget, positive/green). Update bathroom actual to 280k → pushes it to 3% over on that line (neutral/warning). Show the flip detail page pill updates accordingly.

### 7.4 What's explicitly NOT in M4

- Contractor assignments linked to budget lines (M5 wires this up)
- Payment tracking (M6 — paid amounts flow into `actual_amount_thb` automatically then)
- Receipt/invoice uploads per budget line (M11)
- Budget export to Excel (v1.5)

### 7.5 Done when

- A flip has a real working budget. You could run your current 10+ flips in this view today and not miss the Google Sheets.
- Variance is visible at-a-glance on the flip list and flip detail
- The three-state model (budgeted/committed/actual) is explicit and editable

---

## 8. M5 — Contractors: Directory & Assignments

**Goal:** Contractor directory exists. A flip can have contractor assignments with a payment model. Assignments link to budget lines. No payment tracking yet — that's M6.

**Duration:** 5–7 days (~20–28 hours)

### 8.1 Deliverables

**Database:**
- [ ] `contractors` table (DATA_MODEL.md §6.1) with RLS
- [ ] `contractor_assignments` table (DATA_MODEL.md §6.2) with RLS — includes `payment_model` discriminator
- [ ] `contractor_active_commitments` view (DATA_MODEL.md §13.2) — the Q7 conflict detection view
- [ ] Wire `budget_lines.contractor_assignment_id` — when an assignment is created with a contract_amount, optionally create or link to a budget line

**Feature: `/src/features/contractors`**
- [ ] Queries: `listContractors`, `getContractorById`, `listAssignmentsForFlip`, `listAssignmentsForContractor`, `getContractorConflicts` (for date range + contractor)
- [ ] Actions: `createContractor`, `updateContractor`, `createAssignment`, `updateAssignment`, `activateAssignment`, `completeAssignment`, `cancelAssignment`
- [ ] Validators: `contractorSchema`, `assignmentSchema` (with discriminated union for payment_model — fixed_milestone requires contract_amount, time_materials requires rates, etc.)
- [ ] Components:
  - [ ] `<ContractorDirectoryTable>` — all contractors with trade, last assignment, performance rollups
  - [ ] `<ContractorForm>` — create/edit with trade + additional trades multiselect + rate card fields
  - [ ] `<ContractorDetailPage>` — profile + history of assignments across all flips
  - [ ] `<AssignmentList>` — per-flip list of contractor assignments
  - [ ] `<CreateAssignmentDialog>` — select contractor + payment model + scope of work + dates
  - [ ] `<PaymentModelSelector>` — radio + conditional fields based on selection (the Q3=hybrid UI)
  - [ ] `<ContractorConflictWarning>` — shows "this contractor is already active on FLIP-2026-003 during these dates" (the Q7=yes UI)

**Routes:**
- [ ] `/contractors` → directory table
- [ ] `/contractors/[contractorId]` → contractor detail + history
- [ ] `/flips/[flipId]/contractors` → per-flip assignment list (sub-route of flip detail)

**i18n:** `/messages/{th,en}/contractors.json`

### 8.2 Test criteria

**Automated:**
- [ ] Unit tests: `assignmentSchema` discriminated union correctly validates fixed_milestone vs time_materials vs progress_payment
- [ ] Unit tests: `contractor_active_commitments` view computes correct date ranges
- [ ] Integration test: creating a conflict-worthy assignment surfaces the conflict in the UI (doesn't block — just warns)
- [ ] Integration test: completing an assignment updates `contractor_assignments.status` and triggers the performance rollup recalculation (via background job, which we'll stub in M5 and implement in M11)
- [ ] Playwright: add contractor → assign to FLIP-2026-001 as fixed_milestone → try to assign same contractor to FLIP-2026-002 overlapping dates → see conflict warning

**Manual:**
- [ ] Payment model selection smoothly changes which fields appear
- [ ] Thai contractor names render correctly
- [ ] Contractor profile page shows history across all their flips, not just the current one

### 8.3 Demo script

Create contractor "ช่างสมชาย ระบบไฟฟ้า" as an individual with trade=electrical, daily rate 1,500 THB. Assign to FLIP-2026-001 as a fixed_milestone contract, 150,000 THB total, start next Monday, target end in 2 weeks. Create contractor "บริษัท ABC ก่อสร้าง" as a company with trade=general, assign to FLIP-2026-001 as T&M with 3,000 THB/day rate + 10% material markup. Try to assign ช่างสมชาย to FLIP-2026-002 overlapping — see conflict warning. Override and create anyway (valid — contractors can work on multiple flips per Q7).

### 8.4 What's explicitly NOT in M5

- Payment tracking (milestones, T&M entries, payment queue) — that's M6
- Contractor reviews / scorecards with actual ratings — v1.5 (we track the rollup columns in the schema but don't build review UI yet)
- Contractor self-service portal — v2

### 8.5 Done when

- Your 4-team workflow is unblocked: Contractor Manager can see everything
- Every flip's contractors are visible alongside budget
- Conflict detection helps the team make smart assignment decisions

---

## 9. M6 — Contractor Payments

**Goal:** The full payment lifecycle works. Milestones for fixed-price work, T&M entries for time-and-materials work, and a unified payment queue with approval workflow. Paid amounts automatically update `budget_lines.actual_amount_thb`.

**Duration:** 6–8 days (~24–32 hours) — the most complex milestone

### 9.1 Deliverables

**Database:**
- [ ] `contractor_milestones` table (DATA_MODEL.md §6.3) with RLS
- [ ] `contractor_tm_entries` table (DATA_MODEL.md §6.4) with RLS
- [ ] `contractor_payments` table (DATA_MODEL.md §6.5) with RLS
- [ ] Triggers (DATA_MODEL.md §14.3, §14.4): on payment marked `paid`, update contractor rollups and budget line actuals

**Feature: `/src/features/contractors` (expanded)**
- [ ] Queries: `listMilestonesForAssignment`, `listTmEntriesForAssignment`, `listPaymentQueue` (pending + approved across org), `listPaymentsForAssignment`, `listPaymentsForContractor`
- [ ] Actions:
  - [ ] Milestones: `createMilestone`, `updateMilestone`, `markMilestoneCompleted`, `approveMilestone`
  - [ ] T&M: `createTmEntry`, `updateTmEntry`, `approveTmEntry`, `rejectTmEntry`
  - [ ] Payments: `requestPayment`, `approvePayment`, `markPaymentPaid`, `rejectPayment`
- [ ] Validators: `milestoneSchema`, `tmEntrySchema`, `paymentSchema`
- [ ] Components:
  - [ ] `<MilestoneList>` — per-assignment, shows status progression (pending → in_progress → completed → approved → paid)
  - [ ] `<MilestoneForm>` — create/edit milestone (title, amount, target date)
  - [ ] `<TmEntryList>` — per-assignment, tabular timesheet + materials
  - [ ] `<TmEntryForm>` — add labor hours/days OR material cost + receipt upload
  - [ ] `<PaymentQueueTable>` — the Contractor Manager's daily view: all pending/approved payments with approve/mark-paid actions
  - [ ] `<RequestPaymentDialog>` — from a completed milestone, request payment → goes into queue
  - [ ] `<PaymentApprovalDialog>` — Admin/PM approves, Contractor Manager marks paid with payment_method + reference
  - [ ] `<PaymentStatusPill>` — semantic variant per DESIGN_SYSTEM.md (paid=positive, rejected=destructive, others=neutral)

**Routes:**
- [ ] `/contractors/payments` → payment queue (Contractor Manager's home page)
- [ ] `/flips/[flipId]/contractors/[assignmentId]` → assignment detail with milestones OR T&M entries (based on payment_model)

**Integration:**
- [ ] When a payment is marked `paid`, the trigger increments `budget_lines.actual_amount_thb` on the linked budget line — so the flip's budget variance updates automatically
- [ ] Contractor Manager gets notified (via `notifications` table — queue only; actual sending is M11) when a milestone is marked `completed` and needs approval

**i18n:** `/messages/{th,en}/payments.json` (new namespace)

### 9.2 Test criteria

**Automated:**
- [ ] Integration test: full fixed_milestone lifecycle — create assignment → create 3 milestones → mark first completed → approve → request payment → approve payment → mark paid → verify budget line actual_amount updated
- [ ] Integration test: full T&M lifecycle — create assignment → add 5 labor entries + 3 material entries → approve → batch request payment → approve → mark paid → verify totals
- [ ] Integration test: reject a payment — does NOT update budget actuals, milestone returns to `completed` state
- [ ] Integration test: trigger correctness — idempotent (marking paid twice doesn't double-increment)
- [ ] Playwright: Contractor Manager workflow — receive milestone completion notification (simulated) → approve milestone → approve payment → mark paid → see budget page reflects new actual

**Manual:**
- [ ] Payment queue page is fast (this will be used multiple times per day)
- [ ] Approve/mark-paid actions don't require page reloads
- [ ] T&M entry form with receipt upload works on mobile (Contractor Manager on-site)

### 9.3 Demo script

On FLIP-2026-001:
- ช่างสมชาย's fixed_milestone assignment has 3 milestones (50% deposit 75k, 30% midpoint 45k, 20% final 30k)
- Mark milestone 1 completed → request payment → approve → mark paid (bank transfer, ref ABC123)
- Show budget page: Electrical line's actual_amount increased by 75k automatically
- On บริษัท ABC's T&M assignment: add 5 labor days at 3,000 THB + material entry for 15,000 THB tiles + 10% markup (line_total = 16,500)
- Approve all entries → batch request payment for the approved entries → approve → mark paid
- Show budget page: multiple categories updated

### 9.4 What's explicitly NOT in M6

- Automated payment reminders (M11)
- Payment method integrations (bank API, Stripe) — v2 commercial
- Multi-currency — v2 only (THB only in v1)
- Recurring payment templates — YAGNI

### 9.5 Done when

- This replaces your current contractor-payment chaos completely
- The budget-on-the-flip updates automatically as payments flow through
- Payment queue is the Contractor Manager's daily-driver page

---

## 10. M7 — Tasks & Timeline

**Goal:** Tasks per flip with due dates. Milestones (flip-level, not contractor-level) for timeline checkpoints. Overdue indicators.

**Duration:** 3–4 days (~12–18 hours) — simpler milestone, catches breath after M6

### 10.1 Deliverables

**Database:**
- [ ] `tasks` table (DATA_MODEL.md §7.1) with RLS
- [ ] `milestones` table (DATA_MODEL.md §7.2) with RLS (note: these are flip-level milestones, distinct from contractor milestones)
- [ ] Extend `flip_portfolio_dashboard` view to include `open_tasks_count`, `overdue_tasks_count`

**Feature: `/src/features/tasks`**
- [ ] Queries: `listTasksForFlip`, `listTasksForUser`, `listOverdueTasks`, `listMilestonesForFlip`, `getUpcomingMilestones`
- [ ] Actions: `createTask`, `updateTask`, `assignTask`, `completeTask`, `reopenTask`, `createMilestone`, `updateMilestone`, `markMilestoneActual`
- [ ] Validators: `taskSchema`, `milestoneSchema`
- [ ] Components:
  - [ ] `<TaskListPanel>` — per-flip task list with priority + due date + assignee
  - [ ] `<TaskForm>` — create/edit task dialog
  - [ ] `<TaskQuickAdd>` — inline "add task" row at top of task list (no dialog, just type + enter)
  - [ ] `<MyTasksPage>` — cross-flip view of tasks assigned to current user
  - [ ] `<TimelinePanel>` — flip-level milestone list with target + actual dates
  - [ ] `<DueDatePill>` — semantic variant (overdue=destructive, due today/tomorrow=warning, future=neutral)

**Routes:**
- [ ] `/flips/[flipId]/tasks` → task list sub-route
- [ ] `/flips/[flipId]/timeline` → milestone timeline sub-route
- [ ] `/my-tasks` → cross-flip personal task inbox

**i18n:** `/messages/{th,en}/tasks.json`

### 10.2 Test criteria

**Automated:**
- [ ] Unit tests: `<DueDatePill>` variant selection logic across edge cases (today, tomorrow, yesterday, no date)
- [ ] Integration test: completing a task sets `completed_at` + `completed_by`, logs activity
- [ ] Playwright: create tasks on a flip → assign some to self → see them in `/my-tasks` → complete one → gone from list

**Manual:**
- [ ] Quick-add inline works (no dialog, just tab-through)
- [ ] Overdue tasks clearly stand out (bold + destructive red) per DESIGN_SYSTEM.md
- [ ] Mobile: task list is thumb-friendly

### 10.3 Demo script

On FLIP-2026-001 add tasks: "Order bathroom tiles" (assigned to you, due tomorrow), "Site visit Monday" (assigned to contractor manager, due +3 days), "Confirm buyer viewing" (assigned to sales, due yesterday → overdue). Switch to `/my-tasks` → see only yours. Complete "Order tiles" → vanishes. Show overdue task in destructive red in the list and on the portfolio dashboard.

### 10.4 What's explicitly NOT in M7

- Task comments / threads (deferred to M11 with polymorphic comments)
- Task attachments (deferred to M11 with documents)
- Recurring tasks — YAGNI until requested
- Gantt chart view (v1.5)
- Email / LINE reminders on due tasks (M11)

### 10.5 Done when

- Every flip has a working task list
- Overdue tasks are visually obvious
- `/my-tasks` is a legit "my day" inbox

---

## 11. M8 — Investors & Capital Commitments

**Goal:** Investor directory exists. Each flip's capital stack is modeled correctly with the terms_model discriminator. Q1=mixed logic works.

**Duration:** 4–5 days (~16–24 hours)

### 11.1 Deliverables

**Database:**
- [ ] `investors` table (DATA_MODEL.md §8.1) with RLS
- [ ] `capital_commitments` table (DATA_MODEL.md §8.2) with RLS — includes `terms_model` discriminator
- [ ] `investor_position_summary` view (DATA_MODEL.md §13.4)

**Feature: `/src/features/investors`**
- [ ] Queries: `listInvestors`, `getInvestorById`, `listCommitmentsForInvestor`, `listCommitmentsForFlip`, `getInvestorPosition`
- [ ] Actions: `createInvestor`, `updateInvestor`, `createCommitment`, `updateCommitment`, `fundCommitment` (mark funded_at + funded_amount), `calculateReturn` (updates `calculated_return_thb` based on terms_model)
- [ ] Validators: `investorSchema`, `commitmentSchema` (discriminated union per terms_model)
- [ ] Business logic: `calculateInvestorReturn(commitment, flip)` function implementing the Q1=mixed dispatch (see DATA_MODEL.md §8.2 pseudocode)
- [ ] Components:
  - [ ] `<InvestorDirectoryTable>` — all investors + total committed + total distributed + active positions
  - [ ] `<InvestorForm>` — create/edit investor
  - [ ] `<InvestorDetailPage>` — profile + positions across all flips
  - [ ] `<CapitalStackPanel>` — per-flip view: list of commitments with investor + amount + terms summary
  - [ ] `<CreateCommitmentDialog>` — select investor + amount + terms_model + conditional fields (flat interest % vs equity % vs preferred return)
  - [ ] `<TermsModelSelector>` — the Q1=mixed UI: radio + conditional fields
  - [ ] `<ReturnCalculationPreview>` — shows "at exit price X, investor gets Y" live preview

**Routes:**
- [ ] `/investors` → directory
- [ ] `/investors/[investorId]` → investor detail
- [ ] `/flips/[flipId]/capital` → capital stack sub-route

**i18n:** `/messages/{th,en}/investors.json`

### 11.2 Test criteria

**Automated:**
- [ ] Unit tests: `calculateInvestorReturn` for all three terms_models — flat_interest, equity_split (both `returns_capital_first` branches), preferred_return
- [ ] Unit tests: edge cases — zero profit (loss scenario), equity with 100% investor split, etc.
- [ ] Integration test: creating a commitment marks flip.has_investor_capital = true
- [ ] Playwright: create investor → add commitment to flip → see position reflected on investor page

**Manual:**
- [ ] Terms model selector feels clear (not overwhelming)
- [ ] Live return calculation preview updates as user types
- [ ] Thai names with honorifics (คุณ, นาย, นาง) render correctly

### 11.3 Demo script

Create investor "คุณประเสริฐ วงศ์วาณิช" (Thai individual, prefers Thai quarterly statements). Add commitment to FLIP-2026-001: 2,000,000 THB, terms_model=flat_interest, rate=15%. Calculated return: 2,300,000 at exit. Create investor "ABC Capital Co., Ltd." (entity, prefers English monthly). Add commitment to same flip: 3,000,000 THB, terms_model=equity_split, 30% of profit, returns_capital_first=true. Now FLIP-2026-001 has 5M of investor capital funded. Show investor_position_summary reflects both positions.

### 11.4 What's explicitly NOT in M8

- Distributions (M9)
- PDF statements (M9)
- Investor portal / login (v2)
- Waterfall / preferred return complex structures (the `custom` terms_model exists but full UI is v1.5+ when real deals need it)

### 11.5 Done when

- Your actual capital stack across 10+ flips can be modeled in the system
- The Q1=mixed flexibility is real — you can switch between flat_interest and equity_split per deal
- Investor page shows total exposure across all flips

---

## 12. M9 — Distributions & PDF Statements

**Goal:** When a flip closes, distributions are calculated and tracked. Per-period PDF investor statements can be generated.

**Duration:** 4–5 days (~16–24 hours)

### 12.1 Deliverables

**Database:**
- [ ] `distributions` table (DATA_MODEL.md §8.3) with RLS
- [ ] Trigger: on flip `sold_at` set, auto-create `pending` distributions for all commitments on that flip (based on calculated_return)

**Feature: `/src/features/investors` (expanded)**
- [ ] Queries: `listDistributionsForInvestor`, `listDistributionsForFlip`, `listPendingDistributions`, `getInvestorStatementData` (date range)
- [ ] Actions: `createDistribution` (manual), `markDistributionPaid`, `cancelDistribution`, `generateInvestorStatementPdf` (triggers background job)
- [ ] Components:
  - [ ] `<DistributionsQueueTable>` — all pending + paid distributions
  - [ ] `<MarkDistributionPaidDialog>` — similar pattern to payment approval
  - [ ] `<InvestorStatementPreview>` — in-app preview before PDF generation
  - [ ] `<GenerateStatementDialog>` — date range picker + investor + language selector (defaults to investor's `preferred_language`)

**PDF generation:**
- [ ] Server-side, using `@react-pdf/renderer` (or Puppeteer for more complex layouts — decide in build)
- [ ] Template respects investor's preferred language (`th` / `en`)
- [ ] Thai Buddhist Era dates in Thai statements, Gregorian in English
- [ ] Layout: org letterhead area (v1 minimal), investor info, commitments summary, distributions in period, closing balance
- [ ] PDF stored in Supabase Storage at `organizations/{orgId}/investor-statements/{investorId}/{period}.pdf`
- [ ] A link to the PDF is returned; can be downloaded or sent via LINE/email (v2)

**Background job (Trigger.dev):**
- [ ] `generate-investor-statement-pdf` — renders PDF, uploads to Storage, creates `documents` row, returns signed URL

**Routes:**
- [ ] `/investors/[investorId]/statements` → list of generated statements + button to generate new one
- [ ] `/flips/[flipId]/distributions` → sub-route to see distributions for that flip (if any)

**i18n:** Expand `/messages/{th,en}/investors.json` + add PDF-specific templates in `/messages/{th,en}/pdfs.json`

### 12.2 Test criteria

**Automated:**
- [ ] Unit tests: PDF template rendering with edge cases (zero distributions, multiple commitments, Thai long names)
- [ ] Integration test: marking a flip as `sold` auto-creates pending distributions with correct amounts based on each commitment's terms_model
- [ ] Integration test: `generateInvestorStatementPdf` background job creates a documents row, PDF is downloadable
- [ ] Playwright: mark flip sold → see pending distributions → mark one paid → generate statement for investor → PDF downloads and is readable

**Manual:**
- [ ] Thai PDF renders correctly (IBM Plex Sans Thai embedded; no tofu boxes)
- [ ] Buddhist Era dates correct on Thai statements
- [ ] Currency formatting locale-aware
- [ ] A 5-page statement (multiple flips, many distributions) generates in <10 seconds

### 12.3 Demo script

Mark FLIP-2026-001 as sold at 7,500,000 THB (actual ARV). See pending distributions:
- คุณประเสริฐ: 2,300,000 (flat 15% on 2M)
- ABC Capital: capital 3M + 30% of profit (calculated based on cost basis) = ~3,450,000

Mark both as paid via bank transfer. Generate a statement for คุณประเสริฐ, period Q1 2026, Thai language. Open the PDF → see Buddhist Era dates (1 มกราคม 2569 – 31 มีนาคม 2569), investor name, FLIP-2026-001 line, distribution detail, ฿2,300,000 total. Generate same period for ABC Capital in English → same content, Gregorian dates, THB 3,450,000 formatting.

### 12.4 What's explicitly NOT in M9

- Tax documentation (withholding tax, VAT) — v1.5 per local accountant input
- Automatic statement sending via LINE/email — M11
- Investor self-service download portal — v2
- Signed / legally-binding PDF with digital signatures — v2

### 12.5 Done when

- The full flip lifecycle now works: source → flip → renovate → sell → distribute → statement
- You could hand an investor a generated PDF and it looks professional
- Both Thai and English PDFs render without layout bugs

---

## 13. M10 — Listings & Leads

**Goal:** Sales pillar works end-to-end. List a flip, capture buyer inquiries, track them through to closed_won or closed_lost.

**Duration:** 4–5 days (~16–20 hours)

### 13.1 Deliverables

**Database:**
- [ ] `listings` table (DATA_MODEL.md §9.1) with RLS
- [ ] `leads` table (DATA_MODEL.md §9.2) with RLS
- [ ] Trigger: increment `listings.lead_count` on lead insert

**Feature: `/src/features/sales`**
- [ ] Queries: `listListings`, `getListingById`, `listLeadsForListing`, `listActiveLeads`, `listLeadsForUser`
- [ ] Actions: `createListing`, `updateListing`, `publishListing`, `withdrawListing`, `createLead`, `updateLead`, `assignLead`, `progressLead`, `closeLeadWon`, `closeLeadLost`
- [ ] Validators: `listingSchema`, `leadSchema`
- [ ] Components:
  - [ ] `<ListingsBoard>` — active listings with status pills + lead counts
  - [ ] `<ListingForm>` — platform, price, minimum floor price, Thai + English descriptions
  - [ ] `<ListingDetailPage>` — listing info + lead inbox
  - [ ] `<LeadInboxBoard>` — Kanban of leads across listings (new → contacted → viewing → negotiating → offer → won/lost)
  - [ ] `<LeadForm>` — manual lead entry (when someone calls/LINE-messages directly)
  - [ ] `<LeadCard>` — Kanban card with contact info + status
  - [ ] `<RecordOfferDialog>` — for "offer" status: offer amount + date

**Routes:**
- [ ] `/listings` → listings board
- [ ] `/listings/[listingId]` → listing detail + leads
- [ ] `/leads` → cross-listing lead inbox (Kanban)

**Integration:**
- [ ] When a flip moves to stage `listing`, auto-generate a Listing draft (pre-populated from the property + last deal analysis target ARV)
- [ ] When a lead closes won, offer amount feeds into flip's `actual_sale_price_thb` (with confirmation dialog)

**i18n:** `/messages/{th,en}/sales.json`

### 13.2 Test criteria

**Automated:**
- [ ] Integration test: moving flip to `listing` stage creates a draft listing
- [ ] Integration test: closing a lead as won with offer amount updates flip `actual_sale_price_thb` (after confirmation)
- [ ] Integration test: lead count on listing increments on lead creation
- [ ] Playwright: create listing → add 3 leads → progress them through stages → close one as won

**Manual:**
- [ ] Kanban drag-drop feels smooth per DESIGN_SYSTEM.md §5.8
- [ ] Thai + English listing descriptions both editable
- [ ] Closing a won lead correctly triggers distribution creation (if investor capital was used)

### 13.3 Demo script

FLIP-2026-002 (another flip) is at stage `renovating`. Move it to `listing` → see draft listing created at target ARV 6,500,000. Publish to "ddproperty" platform. Over the next "week" (simulate), 3 leads come in. Assign them to different sales team members. Progress one through to "offer" at 6,300,000. Close as won → confirm sale price → flip auto-moves to `under_offer` then `sold`. (This chains nicely with M9's distribution generation.)

### 13.4 What's explicitly NOT in M10

- Listing-platform integrations (auto-post to DDProperty etc.) — v2
- Marketing asset management (photos specifically for listings, vs general docs) — M11
- Public-facing listing page — v2 commercial
- Buyer auto-responder emails — M11

### 13.5 Done when

- Sales pillar is a legit daily-driver for the team
- Flip → listing → sale path is connected end-to-end
- The full 4-pillar system (Sourcing, PM, Contractors, Sales) + Investors cross-cutting is all usable

---

## 14. M11 — Portfolio Dashboard & Polish

**Goal:** The PM's dream view exists. LINE notifications actually fire. Documents upload works. Mobile polish. This is the "does it feel good?" milestone.

**Duration:** 5–7 days (~20–28 hours)

### 14.1 Deliverables

**Database:**
- [ ] `documents` table (DATA_MODEL.md §10.1) with RLS
- [ ] `comments` table (DATA_MODEL.md §10.2) with RLS
- [ ] `notifications` table (DATA_MODEL.md §11.2) with RLS
- [ ] Supabase Storage bucket `documents` configured with RLS policies (org-scoped paths)

**Portfolio Dashboard** (`/src/features/flips`):
- [ ] `<FlipPortfolioDashboard>` — the PM's home page — table using `flip_portfolio_dashboard` view
- [ ] Columns: code, name, stage, days in stage, budget variance (with semantic color), timeline state (with semantic color), open tasks count, overdue count
- [ ] Sortable, filterable by stage
- [ ] Click row → flip detail page

**Document uploads** (cross-cutting `/src/features/documents`):
- [ ] Queries: `listDocumentsForEntity` (polymorphic)
- [ ] Actions: `uploadDocument` (client-side compression + direct Supabase upload + create row), `deleteDocument`
- [ ] Components:
  - [ ] `<DocumentUploader>` — drag-drop or click, multi-file, client-side image compression
  - [ ] `<DocumentGallery>` — grid of photos with lightbox
  - [ ] `<DocumentList>` — list of non-photo documents
- [ ] Integration: flip detail gets "Documents" tab; contractor detail gets docs section; investor gets docs section

**Comments** (cross-cutting `/src/features/comments`):
- [ ] Similar polymorphic pattern
- [ ] Components: `<CommentThread>`, `<AddCommentForm>`, `<CommentItem>`
- [ ] Integration: flip detail, task detail, contractor assignment detail

**LINE Notify integration** (`/src/server/integrations/line-notify.ts`):
- [ ] OAuth flow in settings: users connect their LINE account → stores token → `users.line_user_id` populated
- [ ] Background job `process-notification-queue` runs every 60s, picks up pending notifications, sends via LINE
- [ ] Triggers that create notification rows:
  - [ ] Milestone completed → notify PM + Contractor Manager
  - [ ] Payment requested → notify Admin
  - [ ] Budget variance crosses 10% → notify PM
  - [ ] Task due tomorrow → notify assignee
  - [ ] Task overdue → notify assignee + PM
  - [ ] Lead created → notify assigned salesperson
  - [ ] Flip reaches `listing` stage → notify sales team
  - [ ] Distribution marked pending → notify admin

**Budget variance hourly check** (`/src/server/integrations/trigger.ts`):
- [ ] Trigger.dev task `check-budget-variance-alerts` runs hourly during business hours
- [ ] Finds flips where variance_pct newly crossed +10% threshold, creates notifications

**Mobile polish:**
- [ ] Bottom tab bar tested on actual phones (iOS Safari, Chrome Android)
- [ ] Photo upload from mobile camera tested end-to-end
- [ ] Forms stack correctly on narrow viewports
- [ ] Payment queue and task inbox specifically tuned for mobile use

**i18n:** Expand existing namespaces + add `/messages/{th,en}/notifications.json` with LINE message templates

### 14.2 Test criteria

**Automated:**
- [ ] Integration test: budget variance trigger fires exactly once per threshold crossing (not repeatedly)
- [ ] Integration test: LINE notification send with mocked API
- [ ] Integration test: document upload with org-scoped path, RLS prevents cross-org read
- [ ] Playwright: full PM morning routine — open dashboard → see 2 flips flagged red → click through → see tasks, approve a payment → LINE notification fires

**Manual:**
- [ ] Dashboard feels fast (<300ms load)
- [ ] LINE notifications arrive within 1 minute of trigger
- [ ] Photo upload from iPhone works smoothly
- [ ] Dark mode on mobile looks correct

### 14.3 Demo script

Morning routine:
1. Open `/dashboard` on phone → see 10+ flips, 2 flagged with red variance
2. Tap one → see flip detail, overdue tasks, pending payment approvals
3. Approve payment → LINE notification fires to Contractor Manager within 30 seconds
4. Take a photo of site progress, upload → appears in flip's document gallery
5. Add a comment "วันนี้งานไฟฟ้าช้ากว่ากำหนด" → mentioned PM gets LINE notification
6. Over lunch, check `/my-tasks` → see what's due today

### 14.4 What's explicitly NOT in M11

- Email notifications (Resend) — v2
- Push notifications — v2
- Advanced dashboard customization — v1.5
- Reports / export to Excel — v1.5
- Full-text search across everything — v1.5
- AI-assisted features — v2 deliberate

### 14.5 Done when

- A day in the life of the PM, Contractor Manager, Sourcing Lead, and Sales Lead is all inside this app
- Google Sheets can be closed for good
- The team voluntarily reaches for the app first, not sheets

---

## 15. M12 — Data Migration

**Goal:** Your 10+ current flips, their budgets, contractors, payments, investors, and everything else migrate from Google Sheets into the system. The system becomes the source of truth.

**Duration:** 3–5 days (~12–20 hours) — boring but critical

### 15.1 Deliverables

**Migration strategy:**

Two approaches; choose based on how many flips need migrating and how clean the sheets are:

**Option A — CSV import scripts (if sheets are structured):**
- [ ] `/scripts/migrate/` folder with one TypeScript file per entity type
- [ ] Import order: organizations → users → properties → flips → contractors → assignments → budget → milestones → payments → investors → commitments → distributions → listings → leads
- [ ] Each script reads a CSV exported from Google Sheets, validates with the existing zod schemas, writes via Prisma transactions, logs errors
- [ ] Idempotent — can be re-run safely (uses deterministic external IDs for matching)
- [ ] Run against a staging environment first, verify, then production

**Option B — Hand-entry via UI (if sheets are messy):**
- [ ] Block a weekend, use the app itself to re-enter everything
- [ ] Tedious but forces you to meet the system as a user
- [ ] Discovers UX bugs you didn't know existed
- [ ] Results in cleaner data than automated import

**My recommendation:** Option B for the first flip (as a gauntlet run — discovers all the UX bugs), then Option A for the remaining 9+ once you know the pattern.

**Reconciliation:**
- [ ] After import, for each flip compare: total budgeted / committed / actual / variance against your sheets — they should match exactly
- [ ] Any discrepancy is either a migration bug or a sheet error — both worth finding
- [ ] For investor commitments, verify calculated_return against manual calculations
- [ ] Spot-check contractor payment history — totals and counts per contractor

**Cutover:**
- [ ] Announce to team: "Google Sheets are frozen on DATE X; after that everything is in the system"
- [ ] Archive the sheets (don't delete; keep as historical reference for a year)
- [ ] Add a prominent banner in the app for the first week: "Report any data issues immediately"

### 15.2 Test criteria

**After migration:**
- [ ] All active flips present with correct stage
- [ ] Budget totals match sheets within 0.01 THB
- [ ] Contractor list includes every contractor you've used in the last 2 years
- [ ] All payments to date are recorded
- [ ] Investor commitments total matches your records
- [ ] Documents from sheets linked or re-uploaded (photos that lived in Drive folders)

### 15.3 Demo script

Run through all 10+ active flips in the system. Each one looks complete, realistic, fully populated. Show the portfolio dashboard — all flips, their real numbers, real statuses. Close the Google Sheets browser tab. You're done.

### 15.4 What's explicitly NOT in M12

- Migrating sold/completed historical flips — optional, do if time permits; they're read-only reference
- Migrating lead history from old systems — probably not worth it
- Perfect fidelity — 95% correctness is the target; the last 5% is edge cases you'll catch later

### 15.5 Done when

- The team is working exclusively in the system for at least one full week
- No one is asking "where's the Google Sheet?"
- Budget variance on a flip matches what you'd compute manually
- You confidently delete or archive the Google Sheets

---

## 16. Success metrics (from PRODUCT_SPEC.md §9)

v1 is successful if, 90 days after launch (= end of M12):

- [ ] All 10+ current flips fully migrated off Google Sheets
- [ ] All 4 team members use the system as their primary operational surface
- [ ] Budget variance visible to PM within 24 hours of it occurring
- [ ] New investor statement produceable in under 5 minutes
- [ ] No critical data lives in Google Sheets anymore

These are the non-negotiable goals. Everything else is nice-to-have.

---

## 17. Sequencing rules (why this order)

Why M1 then M2 then M3, not a different order? The logic:

1. **M1 before everything** — no auth + no multi-tenancy = no anything
2. **M2 before M3** — flips come from deal analyses; can't convert without having an analysis
3. **M3 before M4** — budget lines belong to flips; can't exist without flips
4. **M4 before M5** — contractor assignments link to budget lines; chicken-and-egg if reversed
5. **M5 before M6** — payments reference assignments; must exist first
6. **M6 before M11** — budget actuals update via payment triggers, so budget UX isn't "done" until M6 wires this up
7. **M7 sooner or later doesn't matter much** — tasks and timeline are lighter; I put them here to catch breath between the heavy M6 and M8
8. **M8 before M9** — distributions depend on commitments
9. **M9 before M10** — sale price from leads flows into distributions; if M10 were first, you'd wire sale-to-distribution without the distribution infra ready
10. **M10 completes the four pillars** — now the system can do everything a sheets-replacement needs
11. **M11 polishes the whole thing** — notifications, dashboard, docs depend on everything else existing
12. **M12 last** — migrating data before the system is ready = re-migrating later

**Can I skip a milestone?** Yes — if a milestone's domain doesn't apply to your operation. But don't reorder. The dependencies are real.

**What if I want to ship earlier?** After M6, you technically have a replacement for the worst parts of your sheets. You could run production on M6 + M12 (migrate data), and add M7–M11 progressively while live. This is riskier but viable. Your call.

---

## 18. Time estimates — how to read them

The hour estimates assume:
- Vibe-coded with Claude Code (not hand-written)
- Reasonable focused sessions (2–4 hours uninterrupted)
- No new tool learning required (all tools in TECH_STACK.md are familiar or well-documented)
- Docs are the brief — Claude Code isn't guessing at patterns

**Multiply by 1.5×** if you're:
- Splitting attention with ECHO or consulting
- Learning a tool for the first time (happens for Trigger.dev if you haven't used it)
- Building on slow/mobile internet (Claude Code requires bandwidth)

**Multiply by 2×** if you're:
- Hand-writing without Claude Code
- Working distracted (afternoon / evening after other work)
- In unfamiliar territory (RLS debugging, for instance)

Actual elapsed time (calendar days) is 3–5× the focused-hour estimate, because you have a life. 30 focused hours = ~2 weeks of actual calendar time at solo-founder pace.

---

## 19. What could go wrong (risks)

Specific to build execution, not the system itself.

| Risk | Likelihood | Mitigation |
|---|---|---|
| RLS policies have subtle bugs that expose data | Medium | Cross-tenant Playwright test at end of M1; re-run at end of every milestone that adds tables |
| Prisma + Supabase auth context issues | Medium | Follow CONVENTIONS.md §6 carefully; app-layer `organizationId` filtering as defense-in-depth |
| PDF generation is harder than expected on Vercel | Medium | If `@react-pdf/renderer` hits issues, fallback to Puppeteer on Trigger.dev (won't work on Vercel functions due to binary size) |
| LINE Notify deprecated or rate-limited | Low–Medium | LINE is hinting at Notify deprecation; fallback plan: switch to LINE Messaging API (requires official account — more setup but more future-proof) |
| Supabase outages during demo | Low | Supabase SLA is reasonable; worst case, switch to maintenance mode banner |
| Scope creep — "just one more feature" | High | This plan is a contract. New ideas go in OPEN_QUESTIONS.md, not into the current milestone |
| M6 takes 2× the estimate | Medium | Most complex milestone; pad calendar; break into sub-milestones M6a (milestones) and M6b (T&M + payments) if needed |
| Data migration surfaces data model gaps | Medium | Hand-enter the first flip fully before running bulk imports — catches issues early |
| Design drift (adding color / decoration over time) | Medium | DESIGN_SYSTEM.md is the contract; push back on Claude Code if it suggests decorative color |
| Performance degrades with real data | Low–Medium | Performance budget (<300ms P95 queries) established at M4; test with realistic data (100+ budget lines) |

---

## 20. Rhythm & cadence

Suggested working rhythm:

**Daily:**
- Start: 15 min reviewing what's next in current milestone
- Session: 2–4 hour focused build block
- End: commit + push + deploy to preview

**Weekly:**
- Monday: review milestone progress vs. plan; adjust if slipping
- Friday: demo the week's work to yourself (literally walk through the Demo Script for completed milestones)

**Per-milestone:**
- Kickoff: re-read milestone section; answer any open questions
- Mid-milestone: first demo-script dry run (reveals gaps)
- End: full demo script + test criteria + commit "feat(milestone-N): complete"

**Per-phase (every ~3 milestones):**
- Retrospective: what slowed me down? What convention needs tightening?
- Update docs: if CONVENTIONS.md or DATA_MODEL.md needs clarification, do it now while the learning is fresh

---

## 21. The one rule that matters most

**If a milestone isn't meeting its test criteria, don't move on. Fix it first.**

Skipping past a bad M1 means every subsequent milestone inherits its bugs. Skipping past a bad M4 means M6's payment triggers fire wrong. Skipping past a bad M8 means M9 generates wrong statements.

Each milestone is "done" only when:
1. All deliverables exist
2. All test criteria pass
3. The demo script actually works, not "works if you squint"

"Done" is a binary. Pretending it's done is how projects fail.

---

## 22. Decisions captured here (for the record)

| # | Decision | Rationale |
|---|---|---|
| 1 | 12-milestone sequence, in strict dependency order | Every milestone unblocks the next; reordering = refactors |
| 2 | M0 Bootstrap separate from M1 | Let tooling stabilize before building features |
| 3 | RLS tested at end of M1 via cross-tenant Playwright test | Early detection of the highest-risk bug class |
| 4 | M6 (Contractor Payments) explicitly flagged as most complex | Pad the estimate; consider splitting if slipping |
| 5 | M7 (Tasks & Timeline) intentionally lighter, mid-build | Catches breath after M6, before M8's investor complexity |
| 6 | M11 (Polish) AFTER all four pillars | Notifications, dashboard, docs depend on domain data existing |
| 7 | M12 (Data Migration) LAST, not interleaved | Migrating into a moving system = re-migrating |
| 8 | Option B (hand-entry) for first flip, Option A (CSV) for rest | First flip reveals UX bugs; bulk import works once pattern is known |
| 9 | Hour estimates assume vibe-coding with Claude Code | Document the assumption so actual pace is comparable |
| 10 | Each milestone has a Demo Script, not just "features complete" | Forces holistic verification, not box-checking |

---

## 23. What this doc doesn't cover

- **Post-v1 roadmap** — commercial launch plan, AI features, additional locales. That's a separate `V2_ROADMAP.md` once v1 is shipping.
- **Incident response** — on-call, rollback procedures. Not needed until real external users.
- **Performance benchmarking** — specific targets per query. CONVENTIONS.md has principles; a dedicated `PERFORMANCE_BUDGET.md` comes in v1.5.
- **Compliance** — PDPA (Thai data protection), accounting standards for financial reports. Consult a local lawyer before commercial launch.

These are all legitimately out of scope for a 90-day internal tool build.
