-- Add explicit mapping from configurable budget categories to fixed P&L rows.
-- This prevents all budget actuals from being treated as renovation spend.

ALTER TABLE public.budget_categories
  ADD COLUMN pnl_bucket text NOT NULL DEFAULT 'renovation';

UPDATE public.budget_categories
SET pnl_bucket = CASE
  WHEN slug = 'permits_fees' THEN 'transaction'
  WHEN slug = 'contingency' THEN 'other'
  WHEN slug = 'listing_price' THEN 'purchase'
  WHEN slug = 'mortgage' THEN 'holding'
  WHEN slug = 'transfer_fee' THEN 'transaction'
  WHEN slug = 'investor_payment' THEN 'exclude_from_pnl'
  ELSE 'renovation'
END
WHERE deleted_at IS NULL;

ALTER TABLE public.budget_categories
  ADD CONSTRAINT chk_budget_categories_pnl_bucket
  CHECK (
    pnl_bucket IN (
      'purchase',
      'renovation',
      'holding',
      'transaction',
      'selling',
      'marketing',
      'other',
      'exclude_from_pnl'
    )
  );

CREATE INDEX idx_budget_cat_pnl_bucket
  ON public.budget_categories (organization_id, pnl_bucket)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.seed_organization_budget_categories(p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO budget_categories (
    organization_id,
    slug,
    name_th,
    name_en,
    sort_order,
    is_system,
    pnl_bucket
  ) VALUES
    (p_org_id, 'demolition',         'รื้อถอน',                                 'Demolition',              1,  true, 'renovation'),
    (p_org_id, 'structural',         'โครงสร้าง',                               'Structural',              2,  true, 'renovation'),
    (p_org_id, 'electrical',         'ระบบไฟฟ้า',                              'Electrical',              3,  true, 'renovation'),
    (p_org_id, 'plumbing',           'ระบบประปา',                              'Plumbing',                4,  true, 'renovation'),
    (p_org_id, 'hvac',               'ระบบปรับอากาศ',                          'HVAC',                    5,  true, 'renovation'),
    (p_org_id, 'flooring',           'พื้น',                                    'Flooring',                6,  true, 'renovation'),
    (p_org_id, 'walls_paint',        'ผนังและสี',                              'Walls & Paint',           7,  true, 'renovation'),
    (p_org_id, 'kitchen',            'ห้องครัว',                                'Kitchen',                 8,  true, 'renovation'),
    (p_org_id, 'bathroom',           'ห้องน้ำ',                                 'Bathroom',                9,  true, 'renovation'),
    (p_org_id, 'doors_windows',      'ประตูและหน้าต่าง',                       'Doors & Windows',         10, true, 'renovation'),
    (p_org_id, 'furniture',          'เฟอร์นิเจอร์',                           'Furniture',               11, true, 'renovation'),
    (p_org_id, 'appliances',         'เครื่องใช้ไฟฟ้า',                        'Appliances',              12, true, 'renovation'),
    (p_org_id, 'cleaning_finishing', 'ทำความสะอาดและตกแต่งขั้นสุดท้าย',        'Cleaning & Finishing',    13, true, 'renovation'),
    (p_org_id, 'permits_fees',       'ใบอนุญาตและค่าธรรมเนียม',                'Permits & Fees',          14, true, 'transaction'),
    (p_org_id, 'contingency',        'สำรอง',                                   'Contingency',             15, true, 'other')
  ON CONFLICT DO NOTHING;
END;
$$;
