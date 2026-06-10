-- M4.5 — Flip Transactions & Receipts
--
-- Adds `flip_transactions` as the single ledger for every money event on a
-- flip (inflows + outflows). `budget_lines.actual_amount_thb` becomes a
-- trigger-maintained rollup of this table. `flip_cash_summary` view powers
-- the cash balance indicator on the flip detail header.
--
-- Canonical spec: DATA_MODEL.md §5.3 (table), §13.4 (view), §14.5 (trigger).
-- Design rationale: memory/project_m4_5_transactions_and_m10_investor_link.md
-- Applied via Supabase MCP `apply_migration` (wraps in its own transaction).

-- ============================================================================
-- 1. flip_transactions table
-- ============================================================================

CREATE TABLE flip_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flip_id               uuid NOT NULL REFERENCES flips(id) ON DELETE CASCADE,

  -- Only set on outflows that map to a planned budget line. Required when
  -- kind IN ('spend','refund'); must be NULL for every other kind.
  budget_line_id        uuid REFERENCES budget_lines(id) ON DELETE SET NULL,

  date                  date NOT NULL,

  -- Signed: positive = inflow, negative = outflow. A refund against an
  -- outflow is a positive entry tied to the same budget_line_id.
  amount_thb            numeric(14, 2) NOT NULL,

  description           text NOT NULL,

  -- Free-text source for inflows until investor_id FK lands in M10.
  source_note           text,

  kind                  text NOT NULL,

  -- Supabase Storage path in the `budget-receipts` private bucket.
  receipt_path          text,

  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES users(id),
  updated_by            uuid REFERENCES users(id),
  deleted_at            timestamptz,

  CONSTRAINT chk_flip_tx_kind CHECK (
    kind IN ('investor_deposit','loan_disbursement','spend','refund',
             'sale_proceeds','distribution')
  ),
  -- Inflows cannot be tagged to a specific budget line.
  CONSTRAINT chk_flip_tx_budget_line CHECK (
    (kind IN ('spend','refund')) OR budget_line_id IS NULL
  ),
  -- Sign convention matches kind so totals always make sense.
  CONSTRAINT chk_flip_tx_sign CHECK (
    (kind IN ('investor_deposit','loan_disbursement','sale_proceeds','refund')
       AND amount_thb >= 0)
    OR
    (kind IN ('spend','distribution') AND amount_thb <= 0)
  )
);

CREATE INDEX idx_flip_tx_flip
  ON flip_transactions(flip_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_flip_tx_budget_line
  ON flip_transactions(budget_line_id)
  WHERE budget_line_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_flip_tx_org
  ON flip_transactions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_flip_tx_kind
  ON flip_transactions(flip_id, kind) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. updated_at trigger (matches existing live convention: function is
--    `update_updated_at`, trigger name `set_<table>_updated_at`)
-- ============================================================================

CREATE TRIGGER set_flip_transactions_updated_at
  BEFORE UPDATE ON flip_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. RLS (same as budget_lines: <table>_org_members_{read,insert,update,delete})
-- ============================================================================

ALTER TABLE flip_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flip_transactions_org_members_read" ON flip_transactions
  FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "flip_transactions_org_members_insert" ON flip_transactions
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "flip_transactions_org_members_update" ON flip_transactions
  FOR UPDATE
  USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "flip_transactions_org_members_delete" ON flip_transactions
  FOR DELETE
  USING (organization_id IN (SELECT user_org_ids()));

-- ============================================================================
-- 4. recompute_budget_line_actual trigger (§14.5)
-- ============================================================================

CREATE OR REPLACE FUNCTION recompute_budget_line_actual()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_line_id uuid;
BEGIN
  -- Collect the primary budget_line_id that could need recomputing.
  IF TG_OP = 'INSERT' THEN
    v_line_id := NEW.budget_line_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_line_id := OLD.budget_line_id;
  ELSE
    v_line_id := NEW.budget_line_id;
  END IF;

  IF v_line_id IS NOT NULL THEN
    UPDATE budget_lines bl
    SET actual_amount_thb = COALESCE((
      SELECT SUM(t.amount_thb)
      FROM flip_transactions t
      WHERE t.budget_line_id = bl.id
        AND t.deleted_at IS NULL
    ), 0)
    WHERE bl.id = v_line_id;
  END IF;

  -- UPDATE case: the OLD line also needs recomputing if it changed.
  IF TG_OP = 'UPDATE'
     AND OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id
     AND OLD.budget_line_id IS NOT NULL THEN
    UPDATE budget_lines bl
    SET actual_amount_thb = COALESCE((
      SELECT SUM(t.amount_thb)
      FROM flip_transactions t
      WHERE t.budget_line_id = bl.id
        AND t.deleted_at IS NULL
    ), 0)
    WHERE bl.id = OLD.budget_line_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_flip_tx_budget_actual
  AFTER INSERT OR UPDATE OR DELETE ON flip_transactions
  FOR EACH ROW EXECUTE FUNCTION recompute_budget_line_actual();

-- ============================================================================
-- 5. flip_cash_summary view (§13.4)
-- ============================================================================

CREATE VIEW flip_cash_summary AS
SELECT
  f.id AS flip_id,
  f.organization_id,
  COALESCE(SUM(t.amount_thb), 0)                                          AS cash_balance_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'investor_deposit'),  0) AS total_investor_deposits_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'loan_disbursement'), 0) AS total_loans_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'sale_proceeds'),     0) AS total_sale_proceeds_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'spend'),             0) AS total_spend_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'refund'),            0) AS total_refunds_thb,
  COALESCE(SUM(t.amount_thb) FILTER (WHERE t.kind = 'distribution'),      0) AS total_distributions_thb,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL)                         AS transaction_count
FROM flips f
LEFT JOIN flip_transactions t
  ON t.flip_id = f.id AND t.deleted_at IS NULL
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.organization_id;

-- ============================================================================
-- 6. Zero out M4 test values for actual_amount_thb
-- ============================================================================
--
-- Pre-launch: M4 actual values were smoke-test data entered by the operator
-- via the now-removed inline input. From M4.5 onward `actual_amount_thb` is
-- trigger-maintained from `flip_transactions`, so it starts at 0 by
-- definition. See memory/project_m4_5_transactions_and_m10_investor_link.md.

UPDATE budget_lines SET actual_amount_thb = 0;

-- ============================================================================
-- 7. budget-receipts storage bucket + RLS
-- ============================================================================
--
-- Private (not public — receipts contain bank details / invoices). Access is
-- via server-action-minted signed URLs with short TTL (5 min), never direct
-- public URLs. Path convention: `{orgId}/{flipId}/{uuid}.{ext}`.

INSERT INTO storage.buckets (id, name, public)
VALUES ('budget-receipts', 'budget-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Org-members can read objects whose path begins with their org_id.
CREATE POLICY "budget_receipts_org_members_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'budget-receipts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "budget_receipts_org_members_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'budget-receipts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "budget_receipts_org_members_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'budget-receipts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  )
  WITH CHECK (
    bucket_id = 'budget-receipts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "budget_receipts_org_members_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'budget-receipts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );
