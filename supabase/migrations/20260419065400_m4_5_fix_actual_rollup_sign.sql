-- M4.5 hotfix: `budget_lines.actual_amount_thb` should be the net-spend
-- magnitude (spend − refund), matching M4 semantics that every consumer
-- assumes (variance card, burn bar, `flip_budget_summary` view all expect
-- actual ≥ 0 as "how much we spent"). Previous trigger stored a signed sum
-- which produced negative actuals for normal spend lines, breaking variance.
--
-- In `flip_transactions`: spend is negative, refund is positive.
-- Net spend = (spends) − (refunds) = −(sum of signed amounts) = −SUM.

CREATE OR REPLACE FUNCTION recompute_budget_line_actual()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_line_id uuid;
BEGIN
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
      SELECT -SUM(t.amount_thb)
      FROM flip_transactions t
      WHERE t.budget_line_id = bl.id
        AND t.deleted_at IS NULL
    ), 0)
    WHERE bl.id = v_line_id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id
     AND OLD.budget_line_id IS NOT NULL THEN
    UPDATE budget_lines bl
    SET actual_amount_thb = COALESCE((
      SELECT -SUM(t.amount_thb)
      FROM flip_transactions t
      WHERE t.budget_line_id = bl.id
        AND t.deleted_at IS NULL
    ), 0)
    WHERE bl.id = OLD.budget_line_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Backfill existing rows so any data written under the broken trigger
-- becomes consistent. Safe: zeroes out rows with no transactions.
UPDATE budget_lines bl
SET actual_amount_thb = COALESCE((
  SELECT -SUM(t.amount_thb)
  FROM flip_transactions t
  WHERE t.budget_line_id = bl.id
    AND t.deleted_at IS NULL
), 0);
