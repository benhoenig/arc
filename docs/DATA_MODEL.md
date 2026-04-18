# DATA_MODEL.md

## Property Flipping Management System — Database Schema
### Source of truth for all data structures. Referenced by every code generation.

> **Reading this doc:** Every table below is a Postgres table in Supabase. Every relationship has enforced foreign keys. Every table is multi-tenant via `organization_id` + Row-Level Security. Every table has soft-delete via `deleted_at`. Every table has audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).

---

## 1. Conventions (applied to every table)

### 1.1 Standard columns on every table

```sql
id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
created_by      uuid        REFERENCES users(id)
updated_by      uuid        REFERENCES users(id)
deleted_at      timestamptz                                 -- NULL = active; not-null = soft-deleted
```

**Exceptions:** `organizations`, `users`, `roles` (these are the foundation; different rules — noted below).

### 1.2 Naming rules

- Table names: `snake_case`, plural (`flips`, `contractor_assignments`)
- Column names: `snake_case`, singular (`flip_id`, `contractor_id`)
- Foreign keys: `<entity>_id` (e.g. `flip_id`, not `flip`)
- Boolean columns: `is_<state>` or `has_<thing>` (e.g. `is_active`, `has_investor_capital`)
- Timestamp columns: `<event>_at` (e.g. `sold_at`, `paid_at`)
- Enums: defined as Postgres `CHECK` constraints, not Postgres `ENUM` types (easier to evolve)

### 1.3 Metadata columns (JSONB escape hatch)

Tables marked with `metadata JSONB DEFAULT '{}'::jsonb` get a flexible escape hatch for custom fields without schema migrations. YAGNI applies — use `metadata` sparingly, only for truly variable data.

### 1.4 RLS (Row Level Security)

**Every table has RLS enabled.** No exceptions. The default policy for every business-data table:

```sql
-- SELECT
CREATE POLICY "org_members_can_read" ON <table>
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- INSERT / UPDATE / DELETE
CREATE POLICY "org_members_can_write" ON <table>
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
```

Role-specific restrictions (e.g. only Admin can delete) are enforced at the app layer in v1, moved into RLS in v2 when commercial multi-tenant launches.

### 1.5 Soft delete

- All business-data tables have `deleted_at timestamptz NULL`
- Application queries **must** filter `WHERE deleted_at IS NULL` by default (a Prisma middleware enforces this)
- Cascading soft deletes are handled at app layer (e.g. deleting a Flip soft-deletes its budget_lines, tasks, etc.)

### 1.6 Audit log

Every INSERT / UPDATE / DELETE on business-data tables writes to `activity_log` via a trigger. This is built in v1 even though the UI to view it ships in v2.

---

## 2. Foundation tables

### 2.1 `organizations`

The multi-tenant root. Every piece of business data belongs to exactly one organization. In v1 there is one row. In v2 there are many.

```sql
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,                    -- url-safe identifier
  country_code    char(2) NOT NULL DEFAULT 'TH',
  currency        char(3) NOT NULL DEFAULT 'THB',
  timezone        text NOT NULL DEFAULT 'Asia/Bangkok',

  -- commercial launch hooks (NULL in v1)
  stripe_customer_id       text UNIQUE,
  subscription_status      text,                            -- 'trial' | 'active' | 'past_due' | 'canceled' | NULL
  subscription_plan        text,                            -- 'starter' | 'pro' | 'enterprise' | NULL
  subscription_started_at  timestamptz,

  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,       -- org-level config (notification prefs, feature toggles)
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_orgs_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

### 2.2 `users`

Mirrors Supabase auth.users with app-level profile data.

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY,                         -- matches auth.users.id
  email           text NOT NULL UNIQUE,
  full_name       text,
  display_name    text,
  avatar_url      text,
  phone           text,
  line_user_id    text,                                     -- for LINE Notify targeting
  locale          text NOT NULL DEFAULT 'th',               -- 'th' | 'en'
  last_seen_at    timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_line ON users(line_user_id) WHERE line_user_id IS NOT NULL;
```

### 2.3 `roles`

RBAC role definitions. Seeded per organization. Supports i18n via `name_th` / `name_en`.

```sql
CREATE TABLE roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            text NOT NULL,                            -- 'admin' | 'pm' | 'sourcing' | 'contractor_manager' | 'sales' | custom (stable identifier)
  name_th         text NOT NULL,                            -- Thai display name
  name_en         text,                                     -- English display name
  description_th  text,
  description_en  text,
  permissions     jsonb NOT NULL DEFAULT '{}'::jsonb,       -- { "flips": ["read","write"], "budget": ["read"] }
  is_system       boolean NOT NULL DEFAULT false,           -- true for seeded default roles, not deletable
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  UNIQUE (organization_id, slug) WHERE deleted_at IS NULL
);

CREATE INDEX idx_roles_org ON roles(organization_id) WHERE deleted_at IS NULL;
```

**Seeded system roles (per org on creation — slug — name_th / name_en):**
- `admin` — ผู้ดูแลระบบ / Admin — all permissions
- `pm` — ผู้จัดการโครงการ / Project Manager — full access to flips, budget, timeline, contractors
- `sourcing` — ทีมจัดหา / Sourcing — deal pipeline, property library, deal analyses
- `contractor_manager` — ผู้จัดการผู้รับเหมา / Contractor Manager — contractors, assignments, payments
- `sales` — ฝ่ายขายและการตลาด / Sales & Marketing — listings, leads, marketing assets

### 2.4 `user_roles`

Junction table. A user can have multiple roles in an organization, optionally scoped to specific flips (v2 feature; v1 = org-wide only).

```sql
CREATE TABLE user_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  flip_id         uuid REFERENCES flips(id) ON DELETE CASCADE,   -- NULL = org-wide (v1 default)
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users(id),
  deleted_at      timestamptz,

  UNIQUE (organization_id, user_id, role_id, flip_id) WHERE deleted_at IS NULL
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_org ON user_roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_flip ON user_roles(flip_id) WHERE flip_id IS NOT NULL AND deleted_at IS NULL;
```

### 2.5 `org_invitations`

Admin-issued invitation links that let additional users join an existing org. Introduced in M3.5.

- **Tokens are hashed.** Raw token only ever lives in the invite URL; the DB stores SHA-256 hex. Leaked DB backup cannot replay valid invites.
- **Strictly email-bound.** Accepting requires signing up with the exact `email` on the invitation (case-insensitive compare; `email` is stored lowercase via CHECK constraint).
- **7-day expiry**, admin-revocable. Unique partial index ensures only one pending invite per (org, email).

```sql
CREATE TABLE org_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,                         -- CHECK: must equal lower(email)
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  token_hash      text NOT NULL,                         -- sha256 hex of raw token
  expires_at      timestamptz NOT NULL,
  invited_by      uuid REFERENCES users(id),
  accepted_at     timestamptz,
  accepted_by     uuid REFERENCES users(id),
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT chk_invitation_email_lower CHECK (email = lower(email))
);

CREATE UNIQUE INDEX idx_org_invitations_pending ON org_invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_org_invitations_token_hash ON org_invitations (token_hash)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_org_invitations_org ON org_invitations (organization_id)
  WHERE deleted_at IS NULL;
```

**RLS:** Standard org-member SELECT/INSERT/UPDATE. Admin-only gating is enforced in the app layer (`isOrgAdmin()`), not in RLS, so the same table can support "am I already invited?" lookups by non-admins later if needed.

**SECURITY DEFINER functions** (the only paths that bypass RLS for the accept flow, since the accepter has no `user_roles` row yet):

- `get_invitation_by_hash(p_token_hash text)` — returns `{ invitation_id, organization_id, organization_name, email, role_slug, role_name_th, role_name_en, expires_at }` for a valid pending invitation; NULL otherwise. Granted to `anon, authenticated` (anon is allowed so the accept page can render before signup).
- `accept_invitation(p_token_hash text, p_full_name text DEFAULT NULL)` — authenticated-only. Validates the invitation is pending, not expired, not revoked, and matches `auth.email()`. Atomically updates `users.full_name`/`display_name` if provided, inserts the `user_roles` row, marks the invitation accepted, and writes an `activity_log` entry. Raises `P0001` exceptions with coded messages (`not_found`, `expired`, `revoked`, `already_accepted`, `email_mismatch`, `already_member`, `not_authenticated`).

**Gaps (deferred):**
- Accept flow assumes new-user signup. Existing-account-joins-another-org is out of scope until multi-org session switching is built.
- No transactional email delivery. Admins copy the generated link and share via LINE/email manually.

---

## 3. Core domain tables

### 3.1 `properties`

Physical real estate assets. Persists across multiple Flips.

```sql
CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- identification
  nickname        text NOT NULL,                            -- internal label, e.g. "Sathorn Townhouse #3"
  address_line1   text NOT NULL,
  address_line2   text,
  subdistrict     text,                                     -- tambon (ตำบล)
  district        text,                                     -- amphoe (อำเภอ)
  province        text,
  postal_code     text,
  country_code    char(2) NOT NULL DEFAULT 'TH',
  latitude        numeric(10, 7),
  longitude       numeric(10, 7),

  -- legal
  title_deed_number    text,                                -- โฉนด number
  title_deed_type      text,                                -- 'chanote' | 'nor_sor_3_gor' | 'nor_sor_3' | other
  land_area_sqwa       numeric(10, 2),                      -- Thai unit: square wa (1 wa² = 4 m²)
  land_area_sqm        numeric(10, 2),                      -- computed or entered

  -- physical
  property_type        text NOT NULL,                       -- 'condo' | 'townhouse' | 'detached_house' | 'land' | 'commercial' | 'shophouse'
  bedrooms             integer,
  bathrooms            numeric(4, 1),                       -- allow 2.5 etc.
  floor_area_sqm       numeric(10, 2),
  year_built           integer,
  floors               integer,

  -- freeform
  notes                text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES users(id),
  updated_by           uuid REFERENCES users(id),
  deleted_at           timestamptz,

  CONSTRAINT chk_property_type CHECK (property_type IN
    ('condo','townhouse','detached_house','land','commercial','shophouse','other'))
);

CREATE INDEX idx_properties_org ON properties(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_location ON properties(province, district) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_geo ON properties USING GIST (ll_to_earth(latitude, longitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### 3.2 `flips`

The investment lifecycle on a Property. **The central entity of the system.**

```sql
CREATE TABLE flips (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id          uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,

  -- identification
  code                 text NOT NULL,                        -- human-friendly flip code, e.g. "FLIP-2026-014"
  name                 text NOT NULL,                        -- internal name, usually derived from property nickname
  stage_id             uuid NOT NULL REFERENCES flip_stages(id),

  -- underwriting baseline (locked at flip creation, from Deal Analysis)
  baseline_purchase_price_thb     numeric(14, 2),
  baseline_renovation_budget_thb  numeric(14, 2),
  baseline_target_arv_thb         numeric(14, 2),            -- After-Repair Value (target sale price)
  baseline_target_margin_pct      numeric(5, 2),             -- target margin %
  baseline_target_timeline_days   integer,                   -- target days from acquisition to sale

  -- live actuals (updated as flip progresses)
  actual_purchase_price_thb       numeric(14, 2),
  acquired_at                     timestamptz,
  listed_at                       timestamptz,
  sold_at                         timestamptz,
  actual_sale_price_thb           numeric(14, 2),

  -- capital structure flag
  has_investor_capital            boolean NOT NULL DEFAULT false,

  -- status
  is_on_hold                      boolean NOT NULL DEFAULT false,
  on_hold_reason                  text,
  killed_at                       timestamptz,
  killed_reason                   text,                      -- 'pivoted_to_rental' | 'deal_collapsed' | 'market_change' | 'other'

  notes                           text,
  metadata                        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  created_by                      uuid REFERENCES users(id),
  updated_by                      uuid REFERENCES users(id),
  deleted_at                      timestamptz,

  UNIQUE (organization_id, code) WHERE deleted_at IS NULL
);

CREATE INDEX idx_flips_org ON flips(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_flips_property ON flips(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_flips_stage ON flips(stage_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_flips_active ON flips(organization_id)
  WHERE deleted_at IS NULL AND sold_at IS NULL AND killed_at IS NULL;
```

### 3.3 `flip_stages`

Configurable per org. Seeded with defaults. Supports i18n via `name_th` / `name_en` columns.

```sql
CREATE TABLE flip_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            text NOT NULL,                             -- 'sourcing' | 'underwriting' | 'acquiring' | 'renovating' | 'listing' | 'under_offer' | 'sold' (stable identifier, never translated)
  name_th         text NOT NULL,                             -- Thai display name (primary)
  name_en         text,                                      -- English display name (optional override)
  sort_order      integer NOT NULL DEFAULT 0,
  stage_type      text NOT NULL,                             -- 'pre_acquisition' | 'active' | 'exit' | 'terminal'
  is_system       boolean NOT NULL DEFAULT false,            -- seeded stages, name editable but not deletable
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  UNIQUE (organization_id, slug) WHERE deleted_at IS NULL,
  CONSTRAINT chk_stage_type CHECK (stage_type IN
    ('pre_acquisition','active','exit','terminal'))
);

CREATE INDEX idx_flip_stages_org ON flip_stages(organization_id, sort_order) WHERE deleted_at IS NULL;
```

**Note:** No `color` column. Strict monochrome design (see DESIGN_SYSTEM.md) distinguishes stages through text labels and position, not color.

**Seeded default stages (name_th / name_en):**
1. `sourcing` — จัดหา / Sourcing (pre_acquisition) — lead identified
2. `underwriting` — วิเคราะห์ / Underwriting (pre_acquisition) — running deal analysis
3. `negotiating` — เจรจา / Negotiating (pre_acquisition) — offer submitted
4. `acquiring` — ซื้อ / Acquiring (pre_acquisition) — offer accepted, closing in progress
5. `renovating` — ปรับปรุง / Renovating (active) — construction in progress
6. `listing` — ประกาศขาย / Listing (exit) — listed for sale
7. `under_offer` — มีผู้สนใจ / Under Offer (exit) — buyer's offer accepted, closing
8. `sold` — ขายแล้ว / Sold (terminal) — closed
9. `killed` — ยกเลิก / Killed (terminal) — deal dead / pivoted

### 3.4 `flip_team_members`

Who works on what flip. Separate from `user_roles` because team assignment is per-flip operational metadata, not a security role.

```sql
CREATE TABLE flip_team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id         uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_flip    text NOT NULL,                             -- 'pm_lead' | 'sourcing_lead' | 'contractor_lead' | 'sales_lead' | 'contributor'
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid REFERENCES users(id),
  deleted_at      timestamptz,

  UNIQUE (flip_id, user_id, role_in_flip) WHERE deleted_at IS NULL,
  CONSTRAINT chk_role_in_flip CHECK (role_in_flip IN
    ('pm_lead','sourcing_lead','contractor_lead','sales_lead','contributor'))
);

CREATE INDEX idx_flip_team_flip ON flip_team_members(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_flip_team_user ON flip_team_members(user_id) WHERE deleted_at IS NULL;
```

### 3.5 `flip_code_counters`

Atomic per-(org, year) allocator backing the `FLIP-YYYY-###` codes on `flips.code`. Introduced in M3.

A single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING (next_number - 1)` upsert is the serialisation point: inserts seed `next_number = 2` (caller takes 1), conflicts increment by 1 (caller takes the previous value). Concurrent callers are guaranteed distinct numbers. Must run inside the same transaction as the `flips` insert so the counter only advances when the flip is persisted.

```sql
CREATE TABLE flip_code_counters (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year            integer NOT NULL,
  next_number     integer NOT NULL DEFAULT 1,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, year)
);
```

RLS: org-member read/insert/update. No SECURITY DEFINER needed — the insert is always performed by an authenticated user who already has membership.

This table pattern is intentionally generic. Reuse it for any future sequential entity codes (POs, budget line refs, etc.) by adding rows with different `year` granularity or a discriminator column.

---

## 4. Sourcing domain

### 4.1 `deal_analyses`

Underwriting snapshots. Can exist for a property that was never acquired (lost deal).

```sql
CREATE TABLE deal_analyses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id                 uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  flip_id                     uuid REFERENCES flips(id) ON DELETE SET NULL,   -- set when/if the deal becomes a Flip

  -- inputs
  est_purchase_price_thb      numeric(14, 2) NOT NULL,
  est_renovation_cost_thb     numeric(14, 2) NOT NULL,
  est_holding_cost_thb        numeric(14, 2) NOT NULL DEFAULT 0,               -- taxes, utilities, interest during holding
  est_transaction_cost_thb    numeric(14, 2) NOT NULL DEFAULT 0,               -- legal, transfer fees, agent commission on buy
  est_selling_cost_thb        numeric(14, 2) NOT NULL DEFAULT 0,               -- agent commission on sell, transfer fees
  est_arv_thb                 numeric(14, 2) NOT NULL,                         -- after-repair value
  est_timeline_days           integer NOT NULL,

  -- computed (stored for snapshot integrity; recompute on update)
  total_cost_thb              numeric(14, 2) NOT NULL,                         -- sum of all est costs
  est_profit_thb              numeric(14, 2) NOT NULL,                         -- arv - total_cost
  est_margin_pct              numeric(6, 2) NOT NULL,                          -- profit / arv
  est_roi_pct                 numeric(6, 2) NOT NULL,                          -- profit / total_cost

  -- outcome
  decision                    text,                                            -- 'pursue' | 'pass' | 'pending'
  decision_notes              text,
  decided_at                  timestamptz,
  decided_by                  uuid REFERENCES users(id),

  notes                       text,
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES users(id),
  updated_by                  uuid REFERENCES users(id),
  deleted_at                  timestamptz,

  CONSTRAINT chk_decision CHECK (decision IN ('pursue','pass','pending') OR decision IS NULL)
);

CREATE INDEX idx_deal_analyses_property ON deal_analyses(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_analyses_flip ON deal_analyses(flip_id) WHERE flip_id IS NOT NULL;
CREATE INDEX idx_deal_analyses_org_pending ON deal_analyses(organization_id)
  WHERE decision = 'pending' AND deleted_at IS NULL;
```

---

## 5. Budget & Financial domain

### 5.1 `budget_categories`

Configurable per org. Seeded with Thai-market defaults. Supports i18n via `name_th` / `name_en`.

```sql
CREATE TABLE budget_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            text NOT NULL,                                              -- stable identifier, never translated
  name_th         text NOT NULL,                                              -- Thai display name (primary)
  name_en         text,                                                       -- English display name (optional)
  parent_id       uuid REFERENCES budget_categories(id) ON DELETE SET NULL,    -- for category hierarchies
  sort_order      integer NOT NULL DEFAULT 0,
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  UNIQUE (organization_id, slug) WHERE deleted_at IS NULL
);

CREATE INDEX idx_budget_cat_org ON budget_categories(organization_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_budget_cat_parent ON budget_categories(parent_id) WHERE parent_id IS NOT NULL;
```

**Seeded default categories (slug — name_th / name_en):**
- `demolition` — รื้อถอน / Demolition
- `structural` — โครงสร้าง / Structural
- `electrical` — ระบบไฟฟ้า / Electrical
- `plumbing` — ระบบประปา / Plumbing
- `hvac` — ระบบปรับอากาศ / HVAC
- `flooring` — พื้น / Flooring
- `walls_paint` — ผนังและสี / Walls & Paint
- `kitchen` — ห้องครัว / Kitchen
- `bathroom` — ห้องน้ำ / Bathroom
- `doors_windows` — ประตูและหน้าต่าง / Doors & Windows
- `furniture` — เฟอร์นิเจอร์ / Furniture
- `appliances` — เครื่องใช้ไฟฟ้า / Appliances
- `cleaning_finishing` — ทำความสะอาดและตกแต่งขั้นสุดท้าย / Cleaning & Finishing
- `permits_fees` — ใบอนุญาตและค่าธรรมเนียม / Permits & Fees
- `contingency` — สำรอง / Contingency

### 5.2 `budget_lines`

One row per budget line item per flip. **The three-state model: `budgeted_amount`, `committed_amount`, `actual_amount`.**

```sql
CREATE TABLE budget_lines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,
  category_id            uuid NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,

  description            text NOT NULL,

  -- three-state financials
  budgeted_amount_thb    numeric(14, 2) NOT NULL DEFAULT 0,                    -- planned
  committed_amount_thb   numeric(14, 2) NOT NULL DEFAULT 0,                    -- contracted (SoW signed)
  actual_amount_thb      numeric(14, 2) NOT NULL DEFAULT 0,                    -- paid

  -- linkage
  contractor_assignment_id  uuid REFERENCES contractor_assignments(id) ON DELETE SET NULL,

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz
);

CREATE INDEX idx_budget_lines_flip ON budget_lines(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budget_lines_category ON budget_lines(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budget_lines_assignment ON budget_lines(contractor_assignment_id)
  WHERE contractor_assignment_id IS NOT NULL;
```

**Computed views** (see Section 13):
- `flip_budget_summary` — per-flip roll-up of budgeted / committed / actual, with variance
- `category_budget_summary` — per-flip per-category breakdown

---

## 6. Contractor domain

### 6.1 `contractors`

Companies or individuals providing construction services.

```sql
CREATE TABLE contractors (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name                   text NOT NULL,
  contractor_type        text NOT NULL,                                        -- 'individual' | 'company'
  primary_trade          text,                                                 -- 'general' | 'electrical' | 'plumbing' | 'flooring' | 'painting' | 'hvac' | 'other'
  additional_trades      text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- contact
  contact_person         text,
  phone                  text,
  line_id                text,
  email                  text,
  address                text,
  tax_id                 text,                                                 -- เลขประจำตัวผู้เสียภาษี

  -- rate card (for T&M pricing references)
  default_daily_rate_thb numeric(10, 2),                                       -- for individuals
  default_hourly_rate_thb numeric(10, 2),

  -- performance rollups (updated via triggers from contractor_assignments + contractor_payments)
  total_assignments_count integer NOT NULL DEFAULT 0,
  total_paid_thb          numeric(14, 2) NOT NULL DEFAULT 0,
  avg_on_time_pct         numeric(5, 2),                                       -- % of milestones on time
  avg_quality_rating      numeric(3, 2),                                       -- 1-5 scale from reviews
  last_assignment_at      timestamptz,

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_contractor_type CHECK (contractor_type IN ('individual','company'))
);

CREATE INDEX idx_contractors_org ON contractors(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contractors_trade ON contractors(organization_id, primary_trade) WHERE deleted_at IS NULL;
CREATE INDEX idx_contractors_trades_gin ON contractors USING GIN (additional_trades);
```

### 6.2 `contractor_assignments`

A contract between a flip and a contractor for a defined scope of work. **This is where `payment_model` lives.**

```sql
CREATE TABLE contractor_assignments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,
  contractor_id          uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  budget_category_id     uuid REFERENCES budget_categories(id) ON DELETE SET NULL,

  -- scope
  title                  text NOT NULL,                                        -- short label, e.g. "Kitchen renovation"
  scope_of_work          text,                                                 -- long-form description
  start_date             date,
  target_end_date        date,
  actual_end_date        date,

  -- payment model: this is the Q3=hybrid implementation
  payment_model          text NOT NULL,                                        -- 'fixed_milestone' | 'time_materials' | 'progress_payment'

  -- for fixed_milestone / progress_payment: a total contract price
  contract_amount_thb    numeric(14, 2),

  -- for time_materials: rates locked at assignment time
  tm_daily_rate_thb      numeric(10, 2),
  tm_hourly_rate_thb     numeric(10, 2),
  tm_material_markup_pct numeric(5, 2),                                        -- if org charges on materials (or pays with markup)

  -- rollups (updated via triggers from contractor_payments + tm entries)
  total_committed_thb    numeric(14, 2) NOT NULL DEFAULT 0,
  total_paid_thb         numeric(14, 2) NOT NULL DEFAULT 0,

  -- status
  status                 text NOT NULL DEFAULT 'draft',                         -- 'draft' | 'active' | 'completed' | 'canceled' | 'disputed'

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_payment_model CHECK (payment_model IN
    ('fixed_milestone','time_materials','progress_payment')),
  CONSTRAINT chk_assignment_status CHECK (status IN
    ('draft','active','completed','canceled','disputed'))
);

CREATE INDEX idx_assignments_flip ON contractor_assignments(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_contractor ON contractor_assignments(contractor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_active ON contractor_assignments(organization_id, contractor_id)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_assignments_date_range ON contractor_assignments(contractor_id, start_date, target_end_date)
  WHERE status IN ('active','draft') AND deleted_at IS NULL;
```

**Q7 (multi-flip contractors) implementation:** The `idx_assignments_date_range` index + a view `contractor_active_commitments` (Section 13) lets the UI show "what else is this contractor committed to right now" when making new assignments.

### 6.3 `contractor_milestones`

For `payment_model = 'fixed_milestone' | 'progress_payment'`. Not used for T&M.

```sql
CREATE TABLE contractor_milestones (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id          uuid NOT NULL REFERENCES contractor_assignments(id) ON DELETE CASCADE,

  title                  text NOT NULL,                                        -- "50% deposit", "Kitchen frame complete", etc.
  sort_order             integer NOT NULL DEFAULT 0,
  amount_thb             numeric(14, 2) NOT NULL,
  percentage             numeric(5, 2),                                        -- optional; for progress_payment

  target_date            date,
  completed_at           timestamptz,
  completed_by           uuid REFERENCES users(id),
  approved_at            timestamptz,
  approved_by            uuid REFERENCES users(id),

  status                 text NOT NULL DEFAULT 'pending',                       -- 'pending' | 'in_progress' | 'completed' | 'approved' | 'paid' | 'disputed'

  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz,

  CONSTRAINT chk_milestone_status CHECK (status IN
    ('pending','in_progress','completed','approved','paid','disputed'))
);

CREATE INDEX idx_milestones_assignment ON contractor_milestones(assignment_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_milestones_pending_approval ON contractor_milestones(organization_id)
  WHERE status = 'completed' AND deleted_at IS NULL;
```

### 6.4 `contractor_tm_entries`

For `payment_model = 'time_materials'`. Timesheet + materials log entries.

```sql
CREATE TABLE contractor_tm_entries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id          uuid NOT NULL REFERENCES contractor_assignments(id) ON DELETE CASCADE,

  entry_type             text NOT NULL,                                        -- 'labor' | 'material'
  entry_date             date NOT NULL,
  description            text NOT NULL,

  -- labor
  hours_worked           numeric(6, 2),
  days_worked            numeric(6, 2),
  applied_rate_thb       numeric(10, 2),

  -- material
  material_cost_thb      numeric(14, 2),
  material_markup_pct    numeric(5, 2),
  receipt_document_id    uuid REFERENCES documents(id) ON DELETE SET NULL,

  -- computed
  line_total_thb         numeric(14, 2) NOT NULL,

  -- approval
  status                 text NOT NULL DEFAULT 'pending',                       -- 'pending' | 'approved' | 'rejected' | 'paid'
  approved_at            timestamptz,
  approved_by            uuid REFERENCES users(id),

  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_tm_entry_type CHECK (entry_type IN ('labor','material')),
  CONSTRAINT chk_tm_status CHECK (status IN ('pending','approved','rejected','paid'))
);

CREATE INDEX idx_tm_assignment ON contractor_tm_entries(assignment_id, entry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tm_pending ON contractor_tm_entries(organization_id)
  WHERE status = 'pending' AND deleted_at IS NULL;
```

### 6.5 `contractor_payments`

Actual money movements. One row per payment event. References either a milestone or a set of T&M entries.

```sql
CREATE TABLE contractor_payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id          uuid NOT NULL REFERENCES contractor_assignments(id) ON DELETE RESTRICT,
  contractor_id          uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE RESTRICT,

  -- linkage: payment covers either a milestone or a TM batch (not both)
  milestone_id           uuid REFERENCES contractor_milestones(id) ON DELETE SET NULL,

  amount_thb             numeric(14, 2) NOT NULL,
  payment_method         text,                                                 -- 'bank_transfer' | 'cash' | 'check' | 'other'
  payment_reference      text,                                                 -- bank ref no., check no.
  paid_at                timestamptz,

  -- approval workflow
  requested_at           timestamptz NOT NULL DEFAULT now(),
  requested_by           uuid REFERENCES users(id),
  approved_at            timestamptz,
  approved_by            uuid REFERENCES users(id),

  status                 text NOT NULL DEFAULT 'requested',                     -- 'requested' | 'approved' | 'paid' | 'rejected' | 'canceled'

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz,

  CONSTRAINT chk_payment_status CHECK (status IN
    ('requested','approved','paid','rejected','canceled'))
);

CREATE INDEX idx_payments_assignment ON contractor_payments(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_contractor ON contractor_payments(contractor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_queue ON contractor_payments(organization_id, status)
  WHERE status IN ('requested','approved') AND deleted_at IS NULL;
CREATE INDEX idx_payments_flip ON contractor_payments(flip_id) WHERE deleted_at IS NULL;
```

### 6.6 `contractor_reviews`

Post-assignment quality ratings. Used to compute `contractors.avg_quality_rating`.

```sql
CREATE TABLE contractor_reviews (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id          uuid NOT NULL REFERENCES contractor_assignments(id) ON DELETE CASCADE,
  contractor_id          uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,

  quality_rating         integer NOT NULL,                                     -- 1-5
  timeliness_rating      integer NOT NULL,                                     -- 1-5
  communication_rating   integer NOT NULL,                                     -- 1-5
  would_rehire           boolean NOT NULL,
  review_text            text,

  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid NOT NULL REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_quality CHECK (quality_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_timeliness CHECK (timeliness_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_communication CHECK (communication_rating BETWEEN 1 AND 5),
  UNIQUE (assignment_id) WHERE deleted_at IS NULL
);

CREATE INDEX idx_reviews_contractor ON contractor_reviews(contractor_id) WHERE deleted_at IS NULL;
```

---

## 7. Tasks & Timeline domain

### 7.1 `tasks`

Unit of work on a flip. Can be assigned to a user or a contractor.

```sql
CREATE TABLE tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,

  title                  text NOT NULL,
  description            text,
  assigned_to_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  related_assignment_id  uuid REFERENCES contractor_assignments(id) ON DELETE SET NULL,
  flip_stage_id          uuid REFERENCES flip_stages(id) ON DELETE SET NULL,

  priority               text NOT NULL DEFAULT 'normal',                        -- 'low' | 'normal' | 'high' | 'urgent'
  status                 text NOT NULL DEFAULT 'open',                          -- 'open' | 'in_progress' | 'blocked' | 'done' | 'canceled'

  due_date               date,
  completed_at           timestamptz,
  completed_by           uuid REFERENCES users(id),

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_task_priority CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT chk_task_status CHECK (status IN ('open','in_progress','blocked','done','canceled'))
);

CREATE INDEX idx_tasks_flip ON tasks(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON tasks(assigned_to_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_open ON tasks(organization_id, status) WHERE status IN ('open','in_progress') AND deleted_at IS NULL;
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE status NOT IN ('done','canceled') AND deleted_at IS NULL;
```

### 7.2 `milestones`

Major timeline checkpoints at the flip level (not the contractor milestone level).

```sql
CREATE TABLE milestones (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,

  title                  text NOT NULL,
  description            text,
  sort_order             integer NOT NULL DEFAULT 0,
  target_date            date NOT NULL,
  actual_date            date,
  is_critical            boolean NOT NULL DEFAULT false,                        -- on the critical path?

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz
);

CREATE INDEX idx_milestones_flip ON milestones(flip_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_milestones_upcoming ON milestones(target_date)
  WHERE actual_date IS NULL AND deleted_at IS NULL;
```

---

## 8. Investor domain (Q1 = mixed, mostly A & B)

### 8.1 `investors`

```sql
CREATE TABLE investors (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name                   text NOT NULL,
  investor_type          text NOT NULL,                                        -- 'individual' | 'entity'
  contact_person         text,
  phone                  text,
  line_id                text,
  email                  text,
  tax_id                 text,
  address                text,

  -- preferences
  preferred_language     text NOT NULL DEFAULT 'th',                            -- 'th' | 'en'
  preferred_report_cadence text NOT NULL DEFAULT 'monthly',                    -- 'weekly' | 'monthly' | 'quarterly' | 'per_flip'

  -- rollups (updated via triggers)
  active_commitments_count integer NOT NULL DEFAULT 0,
  total_committed_thb      numeric(14, 2) NOT NULL DEFAULT 0,
  total_distributed_thb    numeric(14, 2) NOT NULL DEFAULT 0,

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_investor_type CHECK (investor_type IN ('individual','entity'))
);

CREATE INDEX idx_investors_org ON investors(organization_id) WHERE deleted_at IS NULL;
```

### 8.2 `capital_commitments`

An investor's capital commitment on a specific flip. **This is where the Q1=mixed logic lives.** The `terms_model` column discriminates the deal type; `terms` JSONB holds the specifics.

```sql
CREATE TABLE capital_commitments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE RESTRICT,
  investor_id            uuid NOT NULL REFERENCES investors(id) ON DELETE RESTRICT,

  -- the money
  committed_amount_thb   numeric(14, 2) NOT NULL,
  funded_amount_thb      numeric(14, 2) NOT NULL DEFAULT 0,                    -- money actually received
  committed_at           date NOT NULL,
  funded_at              date,

  -- Q1 discriminator
  terms_model            text NOT NULL,                                         -- 'flat_interest' | 'equity_split' | 'preferred_return' | 'custom'

  -- flat_interest terms
  flat_interest_rate_pct numeric(6, 3),                                         -- e.g. 15.000 = 15% flat return on capital
  flat_interest_period   text,                                                  -- 'per_flip' | 'annualized' | 'total_term'

  -- equity_split terms
  equity_pct             numeric(6, 3),                                         -- investor's share of profit (not of sale price)
  equity_returns_capital_first boolean NOT NULL DEFAULT true,                   -- true = capital returned before split

  -- preferred_return terms
  preferred_return_pct   numeric(6, 3),                                         -- preferred return on capital
  split_after_pref_pct   numeric(6, 3),                                         -- investor's share of profit beyond preferred return

  -- custom terms escape hatch (for weird deals)
  terms                  jsonb NOT NULL DEFAULT '{}'::jsonb,                    -- full copy of terms for audit/reproducibility
  terms_description      text,                                                  -- human-readable summary, e.g. "15% flat, paid at exit"

  -- computed at exit (stored for snapshot integrity)
  calculated_return_thb  numeric(14, 2),                                        -- what investor is owed at exit
  calculation_notes      text,

  -- status
  status                 text NOT NULL DEFAULT 'committed',                     -- 'committed' | 'funded' | 'returning' | 'closed' | 'defaulted'

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_terms_model CHECK (terms_model IN
    ('flat_interest','equity_split','preferred_return','custom')),
  CONSTRAINT chk_commitment_status CHECK (status IN
    ('committed','funded','returning','closed','defaulted')),
  CONSTRAINT chk_flat_interest CHECK (
    terms_model <> 'flat_interest' OR flat_interest_rate_pct IS NOT NULL
  ),
  CONSTRAINT chk_equity_split CHECK (
    terms_model <> 'equity_split' OR equity_pct IS NOT NULL
  )
);

CREATE INDEX idx_commitments_flip ON capital_commitments(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_commitments_investor ON capital_commitments(investor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_commitments_active ON capital_commitments(organization_id)
  WHERE status IN ('funded','returning') AND deleted_at IS NULL;
```

**How Q1=mixed is handled in code:**

The `calculated_return_thb` is computed by a function that dispatches on `terms_model`:

```
function calculateReturn(commitment, flip):
  switch commitment.terms_model:
    case 'flat_interest':
      return commitment.funded_amount_thb * (1 + commitment.flat_interest_rate_pct/100)
    case 'equity_split':
      profit = flip.actual_sale_price_thb - flip.total_cost_thb
      if commitment.equity_returns_capital_first:
        return commitment.funded_amount_thb + (profit * commitment.equity_pct/100)
      else:
        return (flip.actual_sale_price_thb * commitment.equity_pct/100)
    case 'preferred_return':
      // capital back + preferred return + split of remaining
      ...
    case 'custom':
      // requires manual calculation; UI prompts for override
```

This keeps the schema clean while supporting all current deal types.

### 8.3 `distributions`

Payouts back to investors.

```sql
CREATE TABLE distributions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commitment_id          uuid NOT NULL REFERENCES capital_commitments(id) ON DELETE RESTRICT,
  investor_id            uuid NOT NULL REFERENCES investors(id) ON DELETE RESTRICT,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE RESTRICT,

  amount_thb             numeric(14, 2) NOT NULL,
  distribution_type      text NOT NULL,                                         -- 'capital_return' | 'interest' | 'profit_share' | 'preferred_return'
  distribution_date      date NOT NULL,
  payment_method         text,
  payment_reference      text,

  status                 text NOT NULL DEFAULT 'pending',                       -- 'pending' | 'paid' | 'canceled'
  paid_at                timestamptz,

  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_distribution_type CHECK (distribution_type IN
    ('capital_return','interest','profit_share','preferred_return')),
  CONSTRAINT chk_distribution_status CHECK (status IN ('pending','paid','canceled'))
);

CREATE INDEX idx_distributions_commitment ON distributions(commitment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_distributions_investor ON distributions(investor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_distributions_pending ON distributions(organization_id)
  WHERE status = 'pending' AND deleted_at IS NULL;
```

---

## 9. Sales & Marketing domain

### 9.1 `listings`

```sql
CREATE TABLE listings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,

  platform               text NOT NULL,                                         -- 'ddproperty' | 'hipflat' | 'livinginsider' | 'facebook' | 'line_oa' | 'direct' | 'other'
  external_url           text,
  external_listing_id    text,

  asking_price_thb       numeric(14, 2) NOT NULL,
  minimum_price_thb      numeric(14, 2),                                        -- internal floor, not published

  listed_at              timestamptz,
  status                 text NOT NULL DEFAULT 'draft',                         -- 'draft' | 'active' | 'under_offer' | 'sold' | 'withdrawn'

  title                  text,
  description_th         text,
  description_en         text,

  view_count             integer NOT NULL DEFAULT 0,
  lead_count             integer NOT NULL DEFAULT 0,

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_listing_status CHECK (status IN
    ('draft','active','under_offer','sold','withdrawn'))
);

CREATE INDEX idx_listings_flip ON listings(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_active ON listings(organization_id, status)
  WHERE status IN ('active','under_offer') AND deleted_at IS NULL;
```

### 9.2 `leads`

Buyer inquiries on listings.

```sql
CREATE TABLE leads (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  listing_id             uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,   -- denormalized for easier querying

  contact_name           text,
  contact_phone          text,
  contact_email          text,
  contact_line_id        text,

  source                 text,                                                  -- platform name or 'referral' | 'direct'
  initial_message        text,

  status                 text NOT NULL DEFAULT 'new',                           -- 'new' | 'contacted' | 'viewing_scheduled' | 'viewed' | 'negotiating' | 'offer' | 'closed_won' | 'closed_lost'
  assigned_to_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,

  -- offer tracking (if lead progresses)
  offer_amount_thb       numeric(14, 2),
  offer_date             date,

  lost_reason            text,
  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_lead_status CHECK (status IN
    ('new','contacted','viewing_scheduled','viewed','negotiating','offer','closed_won','closed_lost'))
);

CREATE INDEX idx_leads_listing ON leads(listing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_assignee ON leads(assigned_to_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_active ON leads(organization_id, status)
  WHERE status NOT IN ('closed_won','closed_lost') AND deleted_at IS NULL;
```

---

## 10. Documents & Comments (cross-cutting)

### 10.1 `documents`

Polymorphic file storage metadata. Actual files live in Supabase Storage at `organizations/{org_id}/{entity_type}/{entity_id}/{filename}`.

```sql
CREATE TABLE documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- polymorphic association
  entity_type            text NOT NULL,                                         -- 'flip' | 'property' | 'contractor' | 'investor' | 'deal_analysis' | 'contractor_tm_entry'
  entity_id              uuid NOT NULL,

  -- file metadata
  filename               text NOT NULL,
  storage_path           text NOT NULL UNIQUE,                                  -- path in Supabase Storage
  mime_type              text NOT NULL,
  file_size_bytes        bigint NOT NULL,

  -- categorization
  document_type          text,                                                  -- 'photo_before' | 'photo_progress' | 'photo_after' | 'title_deed' | 'contract' | 'receipt' | 'floor_plan' | 'inspection' | 'other'
  caption                text,

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id),
  deleted_at             timestamptz,

  CONSTRAINT chk_entity_type CHECK (entity_type IN
    ('flip','property','contractor','investor','deal_analysis','contractor_tm_entry','listing'))
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_org ON documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_type ON documents(entity_id, document_type) WHERE deleted_at IS NULL;
```

### 10.2 `comments`

Polymorphic discussion threads.

```sql
CREATE TABLE comments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  entity_type            text NOT NULL,                                         -- 'flip' | 'task' | 'budget_line' | 'contractor_assignment' | 'payment' | 'lead'
  entity_id              uuid NOT NULL,

  parent_comment_id      uuid REFERENCES comments(id) ON DELETE CASCADE,        -- for threaded replies

  body                   text NOT NULL,
  mentioned_user_ids     uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid NOT NULL REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  deleted_at             timestamptz
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_comments_mentions ON comments USING GIN (mentioned_user_ids);
```

---

## 11. Audit & Notifications

### 11.1 `activity_log`

Every write on business-data tables. Written by trigger. Read by future audit UI.

```sql
CREATE TABLE activity_log (
  id                     bigserial PRIMARY KEY,
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                uuid REFERENCES users(id) ON DELETE SET NULL,

  entity_type            text NOT NULL,
  entity_id              uuid NOT NULL,

  action                 text NOT NULL,                                         -- 'created' | 'updated' | 'soft_deleted' | 'restored' | custom (e.g. 'milestone_approved')

  changes                jsonb,                                                 -- { field: { from, to } } for updates
  context                jsonb NOT NULL DEFAULT '{}'::jsonb,                    -- request context, ip, etc.

  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activity_org ON activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
```

**v2 consideration:** Partition by month if row count exceeds 10M. TimescaleDB hypertable is an option if activity volume is high.

### 11.2 `notifications`

Outbound LINE / email / in-app notifications. Queue + delivery tracking. Locale-aware: every notification is rendered in the recipient's preferred language.

```sql
CREATE TABLE notifications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  recipient_investor_id  uuid REFERENCES investors(id) ON DELETE CASCADE,      -- for investor-facing notifications (v2)

  channel                text NOT NULL,                                         -- 'line' | 'email' | 'in_app'
  template_slug          text NOT NULL,                                         -- identifier for message template (resolved against locale)
  locale                 text NOT NULL DEFAULT 'th',                            -- 'th' | 'en' — which template variant was rendered
  subject                text,
  body                   text NOT NULL,

  related_entity_type    text,
  related_entity_id      uuid,

  status                 text NOT NULL DEFAULT 'pending',                       -- 'pending' | 'sent' | 'failed' | 'read'
  sent_at                timestamptz,
  read_at                timestamptz,
  error_message          text,

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_notif_channel CHECK (channel IN ('line','email','in_app')),
  CONSTRAINT chk_notif_status CHECK (status IN ('pending','sent','failed','read')),
  CONSTRAINT chk_notif_locale CHECK (locale IN ('th','en')),
  CONSTRAINT chk_notif_recipient CHECK (
    recipient_user_id IS NOT NULL OR recipient_investor_id IS NOT NULL
  )
);

CREATE INDEX idx_notifications_pending ON notifications(status, created_at)
  WHERE status = 'pending';
CREATE INDEX idx_notifications_user ON notifications(recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;
```

**Locale resolution at send time:**
- Recipient is a user → use `users.locale`
- Recipient is an investor → use `investors.preferred_language`
- The `locale` column is stored so if a template is later changed, we know which version was actually delivered.

---

## 12. Feature flags (v1, for v2 exposure)

```sql
CREATE TABLE feature_flags (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,   -- NULL = global flag
  flag_key               text NOT NULL,
  is_enabled             boolean NOT NULL DEFAULT false,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, flag_key)
);

CREATE INDEX idx_feature_flags_lookup ON feature_flags(organization_id, flag_key, is_enabled);
```

---

## 13. Views (computed rollups)

These are Postgres views exposed to the app. They avoid N+1 queries and centralize the rollup logic.

### 13.1 `flip_budget_summary`

```sql
CREATE VIEW flip_budget_summary AS
SELECT
  f.id AS flip_id,
  f.organization_id,
  COALESCE(SUM(bl.budgeted_amount_thb), 0)   AS total_budgeted_thb,
  COALESCE(SUM(bl.committed_amount_thb), 0)  AS total_committed_thb,
  COALESCE(SUM(bl.actual_amount_thb), 0)     AS total_actual_thb,
  COALESCE(SUM(bl.actual_amount_thb), 0) - COALESCE(SUM(bl.budgeted_amount_thb), 0)
    AS variance_thb,
  CASE
    WHEN COALESCE(SUM(bl.budgeted_amount_thb), 0) = 0 THEN NULL
    ELSE (COALESCE(SUM(bl.actual_amount_thb), 0) - COALESCE(SUM(bl.budgeted_amount_thb), 0))
         / NULLIF(SUM(bl.budgeted_amount_thb), 0) * 100
  END AS variance_pct
FROM flips f
LEFT JOIN budget_lines bl
  ON bl.flip_id = f.id AND bl.deleted_at IS NULL
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.organization_id;
```

### 13.2 `contractor_active_commitments`

Answers "what is this contractor committed to right now across all flips" (Q7).

```sql
CREATE VIEW contractor_active_commitments AS
SELECT
  c.id AS contractor_id,
  c.organization_id,
  c.name,
  COUNT(ca.id) FILTER (WHERE ca.status = 'active') AS active_assignments_count,
  SUM(ca.contract_amount_thb) FILTER (WHERE ca.status = 'active') AS active_contract_total_thb,
  SUM(ca.total_paid_thb) FILTER (WHERE ca.status = 'active')      AS active_paid_thb,
  MIN(ca.start_date) FILTER (WHERE ca.status = 'active')          AS earliest_start,
  MAX(ca.target_end_date) FILTER (WHERE ca.status = 'active')     AS latest_target_end,
  array_agg(DISTINCT f.id) FILTER (WHERE ca.status = 'active')    AS active_flip_ids
FROM contractors c
LEFT JOIN contractor_assignments ca
  ON ca.contractor_id = c.id AND ca.deleted_at IS NULL
LEFT JOIN flips f
  ON f.id = ca.flip_id AND f.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.name;
```

### 13.3 `flip_portfolio_dashboard`

The PM's main view — one row per active flip.

```sql
CREATE VIEW flip_portfolio_dashboard AS
SELECT
  f.id AS flip_id,
  f.organization_id,
  f.code,
  f.name,
  fs.slug AS stage_slug,
  fs.name AS stage_name,
  p.nickname AS property_nickname,
  p.district,
  p.province,
  f.baseline_renovation_budget_thb,
  bs.total_actual_thb,
  bs.variance_thb,
  bs.variance_pct,
  f.baseline_target_timeline_days,
  CASE
    WHEN f.acquired_at IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (now() - f.acquired_at))::integer
  END AS days_since_acquisition,
  f.acquired_at,
  f.listed_at,
  f.sold_at,
  (SELECT COUNT(*) FROM tasks t
   WHERE t.flip_id = f.id
     AND t.status IN ('open','in_progress','blocked')
     AND t.deleted_at IS NULL) AS open_tasks_count,
  (SELECT COUNT(*) FROM tasks t
   WHERE t.flip_id = f.id
     AND t.due_date < CURRENT_DATE
     AND t.status NOT IN ('done','canceled')
     AND t.deleted_at IS NULL) AS overdue_tasks_count
FROM flips f
JOIN flip_stages fs ON fs.id = f.stage_id
JOIN properties p ON p.id = f.property_id
LEFT JOIN flip_budget_summary bs ON bs.flip_id = f.id
WHERE f.deleted_at IS NULL
  AND f.sold_at IS NULL
  AND f.killed_at IS NULL;
```

### 13.4 `investor_position_summary`

```sql
CREATE VIEW investor_position_summary AS
SELECT
  i.id AS investor_id,
  i.organization_id,
  i.name,
  COUNT(cc.id) FILTER (WHERE cc.status IN ('committed','funded','returning'))  AS active_commitments,
  SUM(cc.funded_amount_thb) FILTER (WHERE cc.status IN ('funded','returning')) AS total_funded_thb,
  SUM(d.amount_thb) FILTER (WHERE d.status = 'paid')                          AS total_distributed_thb,
  SUM(cc.calculated_return_thb) FILTER (WHERE cc.status = 'returning')
    - COALESCE(SUM(d.amount_thb) FILTER (WHERE d.status = 'paid'), 0)        AS pending_return_thb
FROM investors i
LEFT JOIN capital_commitments cc
  ON cc.investor_id = i.id AND cc.deleted_at IS NULL
LEFT JOIN distributions d
  ON d.investor_id = i.id AND d.deleted_at IS NULL
WHERE i.deleted_at IS NULL
GROUP BY i.id, i.organization_id, i.name;
```

---

## 14. Triggers (automation)

### 14.1 `updated_at` auto-update

Every table with `updated_at` has this trigger:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied per table:
CREATE TRIGGER trg_<table>_updated_at BEFORE UPDATE ON <table>
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 14.2 Activity log writer

```sql
CREATE OR REPLACE FUNCTION log_activity() RETURNS trigger AS $$
DECLARE
  v_action text;
  v_changes jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'soft_deleted';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'restored';
    ELSE
      v_action := 'updated';
    END IF;
    v_changes := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  END IF;

  INSERT INTO activity_log (organization_id, user_id, entity_type, entity_id, action, changes)
  VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

Applied to all business-data tables.

### 14.3 Contractor rollup updater

When a `contractor_payment` changes status to `paid`, update `contractors.total_paid_thb` and `contractor_assignments.total_paid_thb`. Implemented as a single trigger on `contractor_payments`.

### 14.4 Budget line contractor sync

When a `contractor_payment` is paid, increment the corresponding `budget_lines.actual_amount_thb` (matched via `contractor_assignment_id`).

### 14.5 Listing lead counter

When a `lead` is inserted, increment `listings.lead_count`. Standard counter cache pattern.

---

## 15. RLS policies (the multi-tenant boundary)

### 15.1 Helper function

```sql
CREATE OR REPLACE FUNCTION user_org_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT organization_id
  FROM user_roles
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL;
$$;
```

### 15.2 Standard policy template

Applied to every business-data table (every table except `organizations`, `users`, `roles` which have custom policies):

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_org_members_read" ON <table>
  FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "<table>_org_members_write" ON <table>
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "<table>_org_members_update" ON <table>
  FOR UPDATE
  USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "<table>_org_members_delete" ON <table>
  FOR DELETE
  USING (organization_id IN (SELECT user_org_ids()));
```

### 15.3 `organizations` policy

Users can only read organizations they are a member of:

```sql
CREATE POLICY "orgs_members_read" ON organizations
  FOR SELECT
  USING (id IN (SELECT user_org_ids()));

CREATE POLICY "orgs_admin_write" ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.slug = 'admin'
        AND ur.deleted_at IS NULL
    )
  );
```

### 15.4 `users` policy

Users can read their own profile + profiles of users in shared orgs:

```sql
CREATE POLICY "users_self_read" ON users
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT DISTINCT ur2.user_id FROM user_roles ur1
      JOIN user_roles ur2 ON ur2.organization_id = ur1.organization_id
      WHERE ur1.user_id = auth.uid()
        AND ur1.deleted_at IS NULL
        AND ur2.deleted_at IS NULL
    )
  );

CREATE POLICY "users_self_update" ON users
  FOR UPDATE
  USING (id = auth.uid());
```

### 15.5 `activity_log` policy

Read-only for org members (writes are trigger-only, no INSERT policy for users):

```sql
CREATE POLICY "activity_log_org_read" ON activity_log
  FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));
-- No INSERT policy: only the trigger (SECURITY DEFINER) writes.
```

---

## 16. Migration file organization

Follow Supabase convention: timestamped SQL files in `supabase/migrations/`.

```
supabase/migrations/
  20260416000001_foundation_organizations.sql
  20260416000002_foundation_users_roles.sql
  20260416000003_properties.sql
  20260416000004_flip_stages.sql
  20260416000005_flips_and_team.sql
  20260416000006_deal_analyses.sql
  20260416000007_budget.sql
  20260416000008_contractors.sql
  20260416000009_contractor_assignments.sql
  20260416000010_contractor_milestones_tm.sql
  20260416000011_contractor_payments.sql
  20260416000012_contractor_reviews.sql
  20260416000013_tasks_milestones.sql
  20260416000014_investors.sql
  20260416000015_capital_commitments.sql
  20260416000016_distributions.sql
  20260416000017_listings_leads.sql
  20260416000018_documents_comments.sql
  20260416000019_activity_log.sql
  20260416000020_notifications.sql
  20260416000021_feature_flags.sql
  20260416000022_views.sql
  20260416000023_triggers.sql
  20260416000024_rls_policies.sql
  20260416000025_seed_data.sql
```

**Critical rule:** Never edit a migration file after it has been applied. Fix mistakes with a new migration.

---

## 17. Seed data (on org creation)

When a new `organization` row is created, a seed function populates:

1. The 5 system roles (admin, pm, sourcing, contractor_manager, sales)
2. The 9 default flip stages
3. The 15 default budget categories (Thai + English)
4. Default org settings (Thai timezone, THB, LINE Notify disabled until configured)

Seed logic lives in `supabase/seed.sql` and is also triggered from the app's org-creation flow (for multi-tenant v2).

---

## 18. Example queries (performance reference)

These are the 10 most common queries the app will run. They should be O(log n) or better. If any of these require a full table scan, something is wrong.

### 18.1 "Give me the PM dashboard" (single query)
```sql
SELECT * FROM flip_portfolio_dashboard
WHERE organization_id = $1
ORDER BY days_since_acquisition DESC NULLS LAST;
```
Uses view backed by `idx_flips_active`. Expected: <50ms on 100 flips.

### 18.2 "Budget variance alerts"
```sql
SELECT * FROM flip_budget_summary
WHERE organization_id = $1
  AND variance_pct > 10;
```

### 18.3 "Contractor conflict check — is this contractor free in this period?"
```sql
SELECT id, title, flip_id, start_date, target_end_date
FROM contractor_assignments
WHERE contractor_id = $1
  AND status IN ('active','draft')
  AND deleted_at IS NULL
  AND daterange(start_date, target_end_date) && daterange($2::date, $3::date);
```
Uses `idx_assignments_date_range`.

### 18.4 "Payment queue"
```sql
SELECT cp.*, c.name AS contractor_name, f.code AS flip_code
FROM contractor_payments cp
JOIN contractors c ON c.id = cp.contractor_id
JOIN flips f ON f.id = cp.flip_id
WHERE cp.organization_id = $1
  AND cp.status IN ('requested','approved')
  AND cp.deleted_at IS NULL
ORDER BY cp.requested_at ASC;
```

### 18.5 "Investor statement period"
```sql
SELECT
  cc.*, i.name AS investor_name, f.code AS flip_code,
  (SELECT SUM(amount_thb) FROM distributions d
   WHERE d.commitment_id = cc.id AND d.status = 'paid'
     AND d.distribution_date BETWEEN $2 AND $3) AS period_distributed_thb
FROM capital_commitments cc
JOIN investors i ON i.id = cc.investor_id
JOIN flips f ON f.id = cc.flip_id
WHERE cc.investor_id = $4
  AND cc.deleted_at IS NULL
ORDER BY f.code;
```

(Queries 6–10: Flip detail, open tasks per user, overdue milestones, active listings, lead pipeline. Pattern is the same.)

---

## 19. Decisions captured here (for the record)

| # | Decision | Rationale |
|---|---|---|
| 1 | `gen_random_uuid()` not `serial` | Multi-tenant safety; no ID enumeration attacks |
| 2 | CHECK constraints, not Postgres ENUMs | Easier to evolve without migrations |
| 3 | Soft delete via `deleted_at` on all business tables | Multi-tenant data recovery |
| 4 | `organization_id` on every business table | RLS requires it; denormalization is worth it |
| 5 | JSONB `metadata` columns | Escape hatch for v2 custom fields without schema change |
| 6 | Views for common aggregations | Avoids N+1; centralizes logic |
| 7 | Polymorphic `documents` and `comments` tables | File/comment patterns are universal; duplicating per entity is worse |
| 8 | Three-state budget (`budgeted` / `committed` / `actual`) | Matches real cost flow; prevents surprise overruns |
| 9 | `payment_model` discriminator on contractor_assignments | Q3=hybrid requires it |
| 10 | `terms_model` discriminator on capital_commitments | Q1=mixed requires it |
| 11 | `contractor_active_commitments` view | Q7 multi-flip detection |
| 12 | Triggers for rollups (total_paid, lead_count, etc.) | Avoids recalculation on every read |
| 13 | Supabase RLS as the multi-tenant boundary | Not app-layer filters; correctness matters more than perf |
| 14 | Feature flags table from day one | Commercial v2 will need selective feature rollout |
| 15 | Stripe columns nullable on organizations | Commercial v2 is additive, not a refactor |
| 16 | `name_th` / `name_en` pattern on lookup tables (roles, flip_stages, budget_categories) | i18n is v1 scope; slug stays stable as identifier, names are translatable |
| 17 | `locale` column on notifications | Audit trail of which language variant was sent |
| 18 | `users.locale` and `investors.preferred_language` already present | Both respected by i18n rendering at send time |
| 19 | No `color` column on `flip_stages` | Strict monochrome design — stages distinguished by text + position only |

---

## 20. Known trade-offs & v2 evolution paths

- **`activity_log` will get huge.** v1 is fine; v2 partitions by month or migrates to TimescaleDB hypertable.
- **`documents` polymorphic FK** isn't enforced by the DB. App layer must validate `(entity_type, entity_id)` pairs. Acceptable trade-off.
- **`capital_commitments.terms` JSONB** is untyped. Custom deals need UI validation; the app layer owns correctness of the `custom` terms_model.
- **RLS perf on large orgs:** `user_org_ids()` is called on every query. If a single user is in 100+ orgs (commercial v2 power users), cache this in session context. Not a v1 concern.
- **No full-text search in v1.** Add pgvector-backed search later; v1 uses Postgres `ILIKE` for search on names and codes.

---

## Next docs needed after this one

1. **IMPLEMENTATION_PLAN.md** — the 90-day phased build plan using this schema
2. **CONVENTIONS.md** — folder structure, Prisma patterns, component patterns, error handling
3. **API_CONTRACTS.md** (optional, v1.5) — tRPC / route handler contracts once routes stabilize
