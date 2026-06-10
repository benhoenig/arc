-- M5 — Contractors: Directory & Assignments
--
-- Adds the two core contractor tables + conflict-detection view + wires up
-- the budget_lines.contractor_assignment_id FK that M4 deferred (the column
-- existed without a constraint because contractor_assignments didn't exist
-- yet). No payment tracking here — that's M6.
-- Applied via Supabase MCP `apply_migration` (wraps in its own transaction).

-- ============================================================================
-- 1. contractors
-- ============================================================================

CREATE TABLE contractors (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name                    text NOT NULL,
  contractor_type         text NOT NULL,
  primary_trade           text,
  additional_trades       text[] NOT NULL DEFAULT ARRAY[]::text[],

  contact_person          text,
  phone                   text,
  line_id                 text,
  email                   text,
  address                 text,
  tax_id                  text,

  default_daily_rate_thb  numeric(10, 2),
  default_hourly_rate_thb numeric(10, 2),

  total_assignments_count integer NOT NULL DEFAULT 0,
  total_paid_thb          numeric(14, 2) NOT NULL DEFAULT 0,
  avg_on_time_pct         numeric(5, 2),
  avg_quality_rating      numeric(3, 2),
  last_assignment_at      timestamptz,

  notes                   text,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES users(id),
  updated_by              uuid REFERENCES users(id),
  deleted_at              timestamptz,

  CONSTRAINT chk_contractor_type CHECK (contractor_type IN ('individual','company'))
);

CREATE INDEX idx_contractors_org ON contractors(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contractors_trade ON contractors(organization_id, primary_trade) WHERE deleted_at IS NULL;
CREATE INDEX idx_contractors_trades_gin ON contractors USING GIN (additional_trades);

CREATE TRIGGER set_contractors_updated_at
  BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_org_members_read" ON contractors
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractors_org_members_insert" ON contractors
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractors_org_members_update" ON contractors
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractors_org_members_delete" ON contractors
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================================================
-- 2. contractor_assignments
-- ============================================================================

CREATE TABLE contractor_assignments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id                uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,
  contractor_id          uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  budget_category_id     uuid REFERENCES budget_categories(id) ON DELETE SET NULL,

  title                  text NOT NULL,
  scope_of_work          text,
  start_date             date,
  target_end_date        date,
  actual_end_date        date,

  payment_model          text NOT NULL,

  contract_amount_thb    numeric(14, 2),

  tm_daily_rate_thb      numeric(10, 2),
  tm_hourly_rate_thb     numeric(10, 2),
  tm_material_markup_pct numeric(5, 2),

  total_committed_thb    numeric(14, 2) NOT NULL DEFAULT 0,
  total_paid_thb         numeric(14, 2) NOT NULL DEFAULT 0,

  status                 text NOT NULL DEFAULT 'draft',

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
    ('draft','active','completed','canceled','disputed')),
  CONSTRAINT chk_assignment_dates CHECK (
    start_date IS NULL OR target_end_date IS NULL OR target_end_date >= start_date
  ),
  CONSTRAINT chk_payment_model_fields CHECK (
    (payment_model IN ('fixed_milestone','progress_payment') AND contract_amount_thb IS NOT NULL)
    OR
    (payment_model = 'time_materials'
       AND (tm_daily_rate_thb IS NOT NULL OR tm_hourly_rate_thb IS NOT NULL))
  )
);

CREATE INDEX idx_assignments_flip ON contractor_assignments(flip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_contractor ON contractor_assignments(contractor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_active ON contractor_assignments(organization_id, contractor_id)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_assignments_date_range ON contractor_assignments(contractor_id, start_date, target_end_date)
  WHERE status IN ('active','draft') AND deleted_at IS NULL;
CREATE INDEX idx_assignments_category ON contractor_assignments(budget_category_id)
  WHERE budget_category_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER set_contractor_assignments_updated_at
  BEFORE UPDATE ON contractor_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE contractor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_assignments_org_members_read" ON contractor_assignments
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractor_assignments_org_members_insert" ON contractor_assignments
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractor_assignments_org_members_update" ON contractor_assignments
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "contractor_assignments_org_members_delete" ON contractor_assignments
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================================================
-- 3. contractor_active_commitments view (Q7)
-- ============================================================================

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

-- ============================================================================
-- 4. Wire deferred FK on budget_lines.contractor_assignment_id
-- ============================================================================

ALTER TABLE budget_lines
  ADD CONSTRAINT fk_budget_lines_contractor_assignment
  FOREIGN KEY (contractor_assignment_id)
  REFERENCES contractor_assignments(id)
  ON DELETE SET NULL;
