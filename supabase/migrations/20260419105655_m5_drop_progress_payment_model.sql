-- Remove `progress_payment` from the allowed payment models. Pre-launch
-- decision: operators only use fixed_milestone (scope-based) and
-- time_materials (labor + materials). progress_payment (% completion
-- "feeling"-based billing) was too subjective and got axed before any
-- customer data touched the column.
--
-- Safe to drop — no rows use this value today (new table in M5, only
-- smoke-test rows exist).

ALTER TABLE contractor_assignments DROP CONSTRAINT chk_payment_model;
ALTER TABLE contractor_assignments
  ADD CONSTRAINT chk_payment_model CHECK (payment_model IN
    ('fixed_milestone','time_materials'));
