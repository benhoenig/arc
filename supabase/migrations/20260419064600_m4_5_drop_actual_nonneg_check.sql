-- M4.5 follow-up: `budget_lines.actual_amount_thb` is now a signed rollup
-- from `flip_transactions` (negative for net-outflow lines, which is the
-- normal case). The M4-era CHECK `>= 0` is invalid under the ledger model.
ALTER TABLE budget_lines DROP CONSTRAINT IF EXISTS chk_budget_line_actual_nonneg;
