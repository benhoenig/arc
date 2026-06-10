-- ARC schema baseline — consolidated from the live database as of the Neon migration (2026-06).
-- This is the single source of truth for the Neon Postgres schema (public schema only;
-- the managed neon_auth.* schema is owned by Neon Auth). Supersedes the historical files in
-- supabase/migrations/ (M0–M5), which are kept for reference only. RLS is enabled (armed) on
-- every table but has no policies — Prisma connects as table owner and bypasses it; app-level
-- organizationId filtering is the real tenant gate. See db/README.md for the apply workflow.
--
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- FUNCTION: recompute_budget_line_actual()
--


CREATE FUNCTION public.recompute_budget_line_actual() RETURNS trigger
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


--
-- FUNCTION: seed_organization_budget_categories(uuid)
--


CREATE FUNCTION public.seed_organization_budget_categories(p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO budget_categories (organization_id, slug, name_th, name_en, sort_order, is_system) VALUES
    (p_org_id, 'demolition',         'รื้อถอน',                                 'Demolition',              1,  true),
    (p_org_id, 'structural',         'โครงสร้าง',                               'Structural',              2,  true),
    (p_org_id, 'electrical',         'ระบบไฟฟ้า',                              'Electrical',              3,  true),
    (p_org_id, 'plumbing',           'ระบบประปา',                              'Plumbing',                4,  true),
    (p_org_id, 'hvac',               'ระบบปรับอากาศ',                          'HVAC',                    5,  true),
    (p_org_id, 'flooring',           'พื้น',                                    'Flooring',                6,  true),
    (p_org_id, 'walls_paint',        'ผนังและสี',                              'Walls & Paint',           7,  true),
    (p_org_id, 'kitchen',            'ห้องครัว',                                'Kitchen',                 8,  true),
    (p_org_id, 'bathroom',           'ห้องน้ำ',                                 'Bathroom',                9,  true),
    (p_org_id, 'doors_windows',      'ประตูและหน้าต่าง',                       'Doors & Windows',         10, true),
    (p_org_id, 'furniture',          'เฟอร์นิเจอร์',                           'Furniture',               11, true),
    (p_org_id, 'appliances',         'เครื่องใช้ไฟฟ้า',                        'Appliances',              12, true),
    (p_org_id, 'cleaning_finishing', 'ทำความสะอาดและตกแต่งขั้นสุดท้าย',        'Cleaning & Finishing',    13, true),
    (p_org_id, 'permits_fees',       'ใบอนุญาตและค่าธรรมเนียม',                'Permits & Fees',          14, true),
    (p_org_id, 'contingency',        'สำรอง',                                   'Contingency',             15, true)
  ON CONFLICT DO NOTHING;
END;
$$;


--
-- FUNCTION: seed_organization_flip_stages(uuid)
--


CREATE FUNCTION public.seed_organization_flip_stages(p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO flip_stages (organization_id, slug, name_th, name_en, sort_order, stage_type, is_system) VALUES
    (p_org_id, 'sourcing',      'จัดหา',       'Sourcing',      1, 'pre_acquisition', true),
    (p_org_id, 'underwriting',  'วิเคราะห์',    'Underwriting',  2, 'pre_acquisition', true),
    (p_org_id, 'negotiating',   'เจรจา',       'Negotiating',   3, 'pre_acquisition', true),
    (p_org_id, 'acquiring',     'ซื้อ',         'Acquiring',     4, 'pre_acquisition', true),
    (p_org_id, 'renovating',    'ปรับปรุง',     'Renovating',    5, 'active',          true),
    (p_org_id, 'listing',       'ประกาศขาย',   'Listing',       6, 'exit',            true),
    (p_org_id, 'under_offer',   'มีผู้สนใจ',    'Under Offer',   7, 'exit',            true),
    (p_org_id, 'sold',          'ขายแล้ว',     'Sold',          8, 'terminal',        true),
    (p_org_id, 'killed',        'ยกเลิก',      'Killed',        9, 'terminal',        true);
END;
$$;


--
-- FUNCTION: seed_organization_roles(uuid)
--


CREATE FUNCTION public.seed_organization_roles(p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO roles (organization_id, slug, name_th, name_en, description_th, description_en, is_system, permissions) VALUES
    (p_org_id, 'admin',              'ผู้ดูแลระบบ',           'Admin',              'สิทธิ์เต็มรูปแบบในทุกระบบ',                    'Full access to all systems',                          true, '{"all": true}'::jsonb),
    (p_org_id, 'pm',                 'ผู้จัดการโครงการ',       'Project Manager',    'จัดการ flip, งบประมาณ, timeline, ผู้รับเหมา',  'Full access to flips, budget, timeline, contractors', true, '{"flips": ["read","write"], "budget": ["read","write"], "tasks": ["read","write"], "contractors": ["read","write"]}'::jsonb),
    (p_org_id, 'sourcing',           'ทีมจัดหา',              'Sourcing',           'วิเคราะห์ดีลและจัดหาอสังหาฯ',                  'Deal pipeline, property library, deal analyses',     true, '{"properties": ["read","write"], "deal_analyses": ["read","write"]}'::jsonb),
    (p_org_id, 'contractor_manager', 'ผู้จัดการผู้รับเหมา',    'Contractor Manager', 'จัดการผู้รับเหมา, งาน, การจ่ายเงิน',           'Contractors, assignments, payments',                  true, '{"contractors": ["read","write"], "payments": ["read","write"]}'::jsonb),
    (p_org_id, 'sales',              'ฝ่ายขายและการตลาด',     'Sales & Marketing',  'จัดการประกาศขายและลูกค้า',                       'Listings, leads, marketing assets',                   true, '{"listings": ["read","write"], "leads": ["read","write"]}'::jsonb);
END;
$$;


--
-- FUNCTION: update_updated_at()
--


CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- TABLE: activity_log
--


CREATE TABLE public.activity_log (
    id bigint NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    changes jsonb,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- SEQUENCE: activity_log_id_seq
--


CREATE SEQUENCE public.activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: activity_log_id_seq
--


ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;


--
-- TABLE: budget_categories
--


CREATE TABLE public.budget_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    name_th text NOT NULL,
    name_en text,
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- TABLE: budget_lines
--


CREATE TABLE public.budget_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id uuid NOT NULL,
    category_id uuid NOT NULL,
    description text NOT NULL,
    budgeted_amount_thb numeric(14,2) DEFAULT 0 NOT NULL,
    committed_amount_thb numeric(14,2) DEFAULT 0 NOT NULL,
    actual_amount_thb numeric(14,2) DEFAULT 0 NOT NULL,
    contractor_assignment_id uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_budget_line_budgeted_nonneg CHECK ((budgeted_amount_thb >= (0)::numeric)),
    CONSTRAINT chk_budget_line_committed_nonneg CHECK ((committed_amount_thb >= (0)::numeric))
);


--
-- VIEW: category_budget_summary
--


CREATE VIEW public.category_budget_summary AS
 SELECT bc.id AS category_id,
    bc.organization_id,
    bl.flip_id,
    bc.slug,
    bc.name_th,
    bc.name_en,
    bc.sort_order,
    COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric) AS total_budgeted_thb,
    COALESCE(sum(bl.committed_amount_thb), (0)::numeric) AS total_committed_thb,
    COALESCE(sum(bl.actual_amount_thb), (0)::numeric) AS total_actual_thb,
    (COALESCE(sum(bl.actual_amount_thb), (0)::numeric) - COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric)) AS variance_thb,
    count(bl.id) FILTER (WHERE (bl.deleted_at IS NULL)) AS line_count
   FROM (public.budget_categories bc
     JOIN public.budget_lines bl ON (((bl.category_id = bc.id) AND (bl.deleted_at IS NULL))))
  WHERE (bc.deleted_at IS NULL)
  GROUP BY bc.id, bc.organization_id, bl.flip_id, bc.slug, bc.name_th, bc.name_en, bc.sort_order;


--
-- TABLE: contacts
--


CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    contact_type text DEFAULT 'agent'::text NOT NULL,
    phone text,
    line_id text,
    email text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_contact_type CHECK ((contact_type = ANY (ARRAY['seller'::text, 'agent'::text, 'owner'::text, 'developer'::text, 'other'::text])))
);


--
-- TABLE: contractor_assignments
--


CREATE TABLE public.contractor_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id uuid NOT NULL,
    contractor_id uuid NOT NULL,
    budget_category_id uuid,
    title text NOT NULL,
    scope_of_work text,
    start_date date,
    target_end_date date,
    actual_end_date date,
    payment_model text NOT NULL,
    contract_amount_thb numeric(14,2),
    tm_daily_rate_thb numeric(10,2),
    tm_hourly_rate_thb numeric(10,2),
    tm_material_markup_pct numeric(5,2),
    total_committed_thb numeric(14,2) DEFAULT 0 NOT NULL,
    total_paid_thb numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_assignment_dates CHECK (((start_date IS NULL) OR (target_end_date IS NULL) OR (target_end_date >= start_date))),
    CONSTRAINT chk_assignment_status CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'canceled'::text, 'disputed'::text]))),
    CONSTRAINT chk_payment_model CHECK ((payment_model = ANY (ARRAY['fixed_milestone'::text, 'time_materials'::text]))),
    CONSTRAINT chk_payment_model_fields CHECK ((((payment_model = ANY (ARRAY['fixed_milestone'::text, 'progress_payment'::text])) AND (contract_amount_thb IS NOT NULL)) OR ((payment_model = 'time_materials'::text) AND ((tm_daily_rate_thb IS NOT NULL) OR (tm_hourly_rate_thb IS NOT NULL)))))
);


--
-- TABLE: contractors
--


CREATE TABLE public.contractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    contractor_type text NOT NULL,
    primary_trade text,
    additional_trades text[] DEFAULT ARRAY[]::text[] NOT NULL,
    contact_person text,
    phone text,
    line_id text,
    email text,
    address text,
    tax_id text,
    default_daily_rate_thb numeric(10,2),
    default_hourly_rate_thb numeric(10,2),
    total_assignments_count integer DEFAULT 0 NOT NULL,
    total_paid_thb numeric(14,2) DEFAULT 0 NOT NULL,
    avg_on_time_pct numeric(5,2),
    avg_quality_rating numeric(3,2),
    last_assignment_at timestamp with time zone,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_contractor_type CHECK ((contractor_type = ANY (ARRAY['individual'::text, 'company'::text])))
);


--
-- TABLE: flips
--


CREATE TABLE public.flips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    property_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    stage_id uuid NOT NULL,
    baseline_purchase_price_thb numeric(14,2),
    baseline_renovation_budget_thb numeric(14,2),
    baseline_target_arv_thb numeric(14,2),
    baseline_target_margin_pct numeric(5,2),
    baseline_target_timeline_days integer,
    actual_purchase_price_thb numeric(14,2),
    acquired_at timestamp with time zone,
    listed_at timestamp with time zone,
    sold_at timestamp with time zone,
    actual_sale_price_thb numeric(14,2),
    has_investor_capital boolean DEFAULT false NOT NULL,
    is_on_hold boolean DEFAULT false NOT NULL,
    on_hold_reason text,
    killed_at timestamp with time zone,
    killed_reason text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    flip_type text DEFAULT 'float_flip'::text NOT NULL,
    CONSTRAINT chk_flip_type CHECK ((flip_type = ANY (ARRAY['float_flip'::text, 'transfer_in'::text]))),
    CONSTRAINT chk_flips_killed_reason CHECK (((killed_reason IS NULL) OR (killed_reason = ANY (ARRAY['pivoted_to_rental'::text, 'deal_collapsed'::text, 'market_change'::text, 'contract_expired'::text, 'other'::text]))))
);


--
-- VIEW: contractor_active_commitments
--


CREATE VIEW public.contractor_active_commitments AS
 SELECT c.id AS contractor_id,
    c.organization_id,
    c.name,
    count(ca.id) FILTER (WHERE (ca.status = 'active'::text)) AS active_assignments_count,
    sum(ca.contract_amount_thb) FILTER (WHERE (ca.status = 'active'::text)) AS active_contract_total_thb,
    sum(ca.total_paid_thb) FILTER (WHERE (ca.status = 'active'::text)) AS active_paid_thb,
    min(ca.start_date) FILTER (WHERE (ca.status = 'active'::text)) AS earliest_start,
    max(ca.target_end_date) FILTER (WHERE (ca.status = 'active'::text)) AS latest_target_end,
    array_agg(DISTINCT f.id) FILTER (WHERE (ca.status = 'active'::text)) AS active_flip_ids
   FROM ((public.contractors c
     LEFT JOIN public.contractor_assignments ca ON (((ca.contractor_id = c.id) AND (ca.deleted_at IS NULL))))
     LEFT JOIN public.flips f ON (((f.id = ca.flip_id) AND (f.deleted_at IS NULL))))
  WHERE (c.deleted_at IS NULL)
  GROUP BY c.id, c.organization_id, c.name;


--
-- TABLE: deal_analyses
--


CREATE TABLE public.deal_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    property_id uuid NOT NULL,
    flip_id uuid,
    est_purchase_price_thb numeric(14,2) NOT NULL,
    est_renovation_cost_thb numeric(14,2) NOT NULL,
    est_holding_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    est_transaction_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    est_selling_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    est_arv_thb numeric(14,2) NOT NULL,
    est_timeline_days integer NOT NULL,
    total_cost_thb numeric(14,2) NOT NULL,
    est_profit_thb numeric(14,2) NOT NULL,
    est_margin_pct numeric(6,2) NOT NULL,
    est_roi_pct numeric(6,2) NOT NULL,
    decision text,
    decision_notes text,
    decided_at timestamp with time zone,
    decided_by uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    flip_type text DEFAULT 'float_flip'::text NOT NULL,
    deposit_amount_thb numeric(14,2),
    contract_months integer,
    marketing_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    label character varying(100) DEFAULT NULL::character varying,
    other_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_decision CHECK (((decision = ANY (ARRAY['pursue'::text, 'pass'::text, 'pending'::text])) OR (decision IS NULL))),
    CONSTRAINT chk_flip_type CHECK ((flip_type = ANY (ARRAY['transfer_in'::text, 'float_flip'::text])))
);


--
-- TABLE: feature_flags
--


CREATE TABLE public.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    flag_key text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- VIEW: flip_budget_summary
--


CREATE VIEW public.flip_budget_summary AS
 SELECT f.id AS flip_id,
    f.organization_id,
    COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric) AS total_budgeted_thb,
    COALESCE(sum(bl.committed_amount_thb), (0)::numeric) AS total_committed_thb,
    COALESCE(sum(bl.actual_amount_thb), (0)::numeric) AS total_actual_thb,
    (COALESCE(sum(bl.actual_amount_thb), (0)::numeric) - COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric)) AS variance_thb,
        CASE
            WHEN (COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric) = (0)::numeric) THEN NULL::numeric
            ELSE (((COALESCE(sum(bl.actual_amount_thb), (0)::numeric) - COALESCE(sum(bl.budgeted_amount_thb), (0)::numeric)) / NULLIF(sum(bl.budgeted_amount_thb), (0)::numeric)) * (100)::numeric)
        END AS variance_pct,
    count(bl.id) FILTER (WHERE (bl.deleted_at IS NULL)) AS line_count
   FROM (public.flips f
     LEFT JOIN public.budget_lines bl ON (((bl.flip_id = f.id) AND (bl.deleted_at IS NULL))))
  WHERE (f.deleted_at IS NULL)
  GROUP BY f.id, f.organization_id;


--
-- TABLE: flip_transactions
--


CREATE TABLE public.flip_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id uuid NOT NULL,
    budget_line_id uuid,
    date date NOT NULL,
    amount_thb numeric(14,2) NOT NULL,
    description text NOT NULL,
    source_note text,
    kind text NOT NULL,
    receipt_path text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_flip_tx_budget_line CHECK (((kind = ANY (ARRAY['spend'::text, 'refund'::text])) OR (budget_line_id IS NULL))),
    CONSTRAINT chk_flip_tx_kind CHECK ((kind = ANY (ARRAY['investor_deposit'::text, 'loan_disbursement'::text, 'spend'::text, 'refund'::text, 'sale_proceeds'::text, 'distribution'::text]))),
    CONSTRAINT chk_flip_tx_sign CHECK ((((kind = ANY (ARRAY['investor_deposit'::text, 'loan_disbursement'::text, 'sale_proceeds'::text, 'refund'::text])) AND (amount_thb >= (0)::numeric)) OR ((kind = ANY (ARRAY['spend'::text, 'distribution'::text])) AND (amount_thb <= (0)::numeric))))
);


--
-- VIEW: flip_cash_summary
--


CREATE VIEW public.flip_cash_summary AS
 SELECT f.id AS flip_id,
    f.organization_id,
    COALESCE(sum(t.amount_thb), (0)::numeric) AS cash_balance_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'investor_deposit'::text)), (0)::numeric) AS total_investor_deposits_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'loan_disbursement'::text)), (0)::numeric) AS total_loans_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'sale_proceeds'::text)), (0)::numeric) AS total_sale_proceeds_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'spend'::text)), (0)::numeric) AS total_spend_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'refund'::text)), (0)::numeric) AS total_refunds_thb,
    COALESCE(sum(t.amount_thb) FILTER (WHERE (t.kind = 'distribution'::text)), (0)::numeric) AS total_distributions_thb,
    count(t.id) FILTER (WHERE (t.deleted_at IS NULL)) AS transaction_count
   FROM (public.flips f
     LEFT JOIN public.flip_transactions t ON (((t.flip_id = f.id) AND (t.deleted_at IS NULL))))
  WHERE (f.deleted_at IS NULL)
  GROUP BY f.id, f.organization_id;


--
-- TABLE: flip_code_counters
--


CREATE TABLE public.flip_code_counters (
    organization_id uuid NOT NULL,
    year integer NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TABLE: flip_stages
--


CREATE TABLE public.flip_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    name_th text NOT NULL,
    name_en text,
    sort_order integer DEFAULT 0 NOT NULL,
    stage_type text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_stage_type CHECK ((stage_type = ANY (ARRAY['pre_acquisition'::text, 'active'::text, 'exit'::text, 'terminal'::text])))
);


--
-- TABLE: flip_team_members
--


CREATE TABLE public.flip_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_flip text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_role_in_flip CHECK ((role_in_flip = ANY (ARRAY['pm_lead'::text, 'sourcing_lead'::text, 'contractor_lead'::text, 'sales_lead'::text, 'contributor'::text])))
);


--
-- TABLE: properties
--


CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    listing_name text NOT NULL,
    address_line1 text,
    address_line2 text,
    subdistrict text,
    district text,
    province text,
    postal_code text,
    country_code character(2) DEFAULT 'TH'::bpchar NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    title_deed_number text,
    title_deed_type text,
    land_area_sqwa numeric(10,2),
    land_area_sqm numeric(10,2),
    property_type text NOT NULL,
    bedrooms integer,
    bathrooms numeric(4,1),
    floor_area_sqm numeric(10,2),
    year_built integer,
    floors integer,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    project_id uuid,
    contact_id uuid,
    asking_price_thb numeric(14,2),
    price_remark text,
    listing_url text,
    floor_level integer,
    sourcing_status text DEFAULT 'new'::text NOT NULL,
    thumbnail_path text,
    CONSTRAINT chk_property_type CHECK ((property_type = ANY (ARRAY['condo'::text, 'townhouse'::text, 'detached_house'::text, 'land'::text, 'commercial'::text, 'shophouse'::text, 'other'::text]))),
    CONSTRAINT chk_sourcing_status CHECK ((sourcing_status = ANY (ARRAY['new'::text, 'evaluating'::text, 'site_visit'::text, 'negotiating'::text, 'under_contract'::text, 'signed'::text, 'converted'::text, 'dropped'::text])))
);


--
-- VIEW: flip_portfolio_dashboard
--


CREATE VIEW public.flip_portfolio_dashboard AS
 SELECT f.id AS flip_id,
    f.organization_id,
    f.code,
    f.name,
    f.stage_id,
    s.slug AS stage_slug,
    s.name_th AS stage_name_th,
    s.name_en AS stage_name_en,
    s.stage_type,
    f.property_id,
    p.listing_name AS property_listing_name,
    p.thumbnail_path AS property_thumbnail_path,
    f.baseline_purchase_price_thb,
    f.baseline_renovation_budget_thb,
    f.baseline_target_arv_thb,
    f.baseline_target_margin_pct,
    f.baseline_target_timeline_days,
    f.actual_purchase_price_thb,
    f.acquired_at,
    f.listed_at,
    f.sold_at,
    f.actual_sale_price_thb,
    f.is_on_hold,
    f.killed_at,
    f.has_investor_capital,
    ( SELECT count(*) AS count
           FROM public.flip_team_members tm
          WHERE ((tm.flip_id = f.id) AND (tm.deleted_at IS NULL))) AS team_member_count,
    bs.total_budgeted_thb,
    bs.total_committed_thb,
    bs.total_actual_thb,
    bs.variance_thb,
    bs.variance_pct,
    bs.line_count AS budget_line_count,
    f.created_at,
    f.updated_at
   FROM (((public.flips f
     JOIN public.flip_stages s ON ((s.id = f.stage_id)))
     JOIN public.properties p ON ((p.id = f.property_id)))
     LEFT JOIN public.flip_budget_summary bs ON ((bs.flip_id = f.id)))
  WHERE (f.deleted_at IS NULL);


--
-- TABLE: flip_revisions
--


CREATE TABLE public.flip_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id uuid NOT NULL,
    revision_number integer NOT NULL,
    revision_type text NOT NULL,
    reason_notes text,
    sunk_deposit_thb numeric(14,2) DEFAULT 0 NOT NULL,
    sunk_reno_spent_thb numeric(14,2) DEFAULT 0 NOT NULL,
    sunk_marketing_spent_thb numeric(14,2) DEFAULT 0 NOT NULL,
    sunk_other_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_remaining_property_cost_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_transfer_fees_cash_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_transfer_fees_loan_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_loan_origination_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_reno_budget_thb numeric(14,2) DEFAULT 0 NOT NULL,
    revised_target_arv_thb numeric(14,2) NOT NULL,
    revised_target_timeline_days integer NOT NULL,
    total_capital_deployed_thb numeric(14,2) NOT NULL,
    projected_profit_thb numeric(14,2) NOT NULL,
    projected_roi_pct numeric(6,2) NOT NULL,
    projected_margin_pct numeric(6,2) NOT NULL,
    walk_away_loss_thb numeric(14,2) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    original_contract_price_thb numeric(14,2),
    new_marketing_budget_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_commission_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_additional_deposit_thb numeric(14,2) DEFAULT 0 NOT NULL,
    new_additional_expense_thb numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_revision_type CHECK ((revision_type = ANY (ARRAY['pivot_to_transfer_in'::text, 'reunderwrite'::text])))
);


--
-- TABLE: org_invitations
--


CREATE TABLE public.org_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_invitation_email_lower CHECK ((email = lower(email)))
);


--
-- TABLE: organizations
--


CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    country_code character(2) DEFAULT 'TH'::bpchar NOT NULL,
    currency character(3) DEFAULT 'THB'::bpchar NOT NULL,
    timezone text DEFAULT 'Asia/Bangkok'::text NOT NULL,
    stripe_customer_id text,
    subscription_status text,
    subscription_plan text,
    subscription_started_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- TABLE: projects
--


CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    developer text,
    location text,
    property_type text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- TABLE: roles
--


CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    name_th text NOT NULL,
    name_en text,
    description_th text,
    description_en text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- TABLE: user_roles
--


CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    flip_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone
);


--
-- TABLE: users
--


CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    display_name text,
    avatar_url text,
    phone text,
    line_user_id text,
    locale text DEFAULT 'th'::text NOT NULL,
    last_seen_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- DEFAULT: activity_log id
--


ALTER TABLE ONLY public.activity_log ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq'::regclass);


--
-- CONSTRAINT: activity_log activity_log_pkey
--


ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: budget_categories budget_categories_pkey
--


ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: budget_lines budget_lines_pkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: contacts contacts_pkey
--


ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: contractor_assignments contractor_assignments_pkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: contractors contractors_pkey
--


ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: deal_analyses deal_analyses_pkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: feature_flags feature_flags_organization_id_flag_key_key
--


ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_organization_id_flag_key_key UNIQUE (organization_id, flag_key);


--
-- CONSTRAINT: feature_flags feature_flags_pkey
--


ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: flip_code_counters flip_code_counters_pkey
--


ALTER TABLE ONLY public.flip_code_counters
    ADD CONSTRAINT flip_code_counters_pkey PRIMARY KEY (organization_id, year);


--
-- CONSTRAINT: flip_revisions flip_revisions_pkey
--


ALTER TABLE ONLY public.flip_revisions
    ADD CONSTRAINT flip_revisions_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: flip_stages flip_stages_pkey
--


ALTER TABLE ONLY public.flip_stages
    ADD CONSTRAINT flip_stages_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: flip_team_members flip_team_members_pkey
--


ALTER TABLE ONLY public.flip_team_members
    ADD CONSTRAINT flip_team_members_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: flip_transactions flip_transactions_pkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: flips flips_pkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: org_invitations org_invitations_pkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: organizations organizations_pkey
--


ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: organizations organizations_slug_key
--


ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- CONSTRAINT: organizations organizations_stripe_customer_id_key
--


ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- CONSTRAINT: projects projects_pkey
--


ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: properties properties_pkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: roles roles_pkey
--


ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: user_roles user_roles_pkey
--


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- CONSTRAINT: users users_email_key
--


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- CONSTRAINT: users users_pkey
--


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- INDEX: idx_activity_entity
--


CREATE INDEX idx_activity_entity ON public.activity_log USING btree (entity_type, entity_id, created_at DESC);


--
-- INDEX: idx_activity_org
--


CREATE INDEX idx_activity_org ON public.activity_log USING btree (organization_id, created_at DESC);


--
-- INDEX: idx_activity_user
--


CREATE INDEX idx_activity_user ON public.activity_log USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- INDEX: idx_assignments_active
--


CREATE INDEX idx_assignments_active ON public.contractor_assignments USING btree (organization_id, contractor_id) WHERE ((status = 'active'::text) AND (deleted_at IS NULL));


--
-- INDEX: idx_assignments_category
--


CREATE INDEX idx_assignments_category ON public.contractor_assignments USING btree (budget_category_id) WHERE ((budget_category_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- INDEX: idx_assignments_contractor
--


CREATE INDEX idx_assignments_contractor ON public.contractor_assignments USING btree (contractor_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_assignments_date_range
--


CREATE INDEX idx_assignments_date_range ON public.contractor_assignments USING btree (contractor_id, start_date, target_end_date) WHERE ((status = ANY (ARRAY['active'::text, 'draft'::text])) AND (deleted_at IS NULL));


--
-- INDEX: idx_assignments_flip
--


CREATE INDEX idx_assignments_flip ON public.contractor_assignments USING btree (flip_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_budget_cat_org
--


CREATE INDEX idx_budget_cat_org ON public.budget_categories USING btree (organization_id, sort_order) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_budget_cat_parent
--


CREATE INDEX idx_budget_cat_parent ON public.budget_categories USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- INDEX: idx_budget_lines_assignment
--


CREATE INDEX idx_budget_lines_assignment ON public.budget_lines USING btree (contractor_assignment_id) WHERE (contractor_assignment_id IS NOT NULL);


--
-- INDEX: idx_budget_lines_category
--


CREATE INDEX idx_budget_lines_category ON public.budget_lines USING btree (category_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_budget_lines_flip
--


CREATE INDEX idx_budget_lines_flip ON public.budget_lines USING btree (flip_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_budget_lines_org
--


CREATE INDEX idx_budget_lines_org ON public.budget_lines USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_contacts_org
--


CREATE INDEX idx_contacts_org ON public.contacts USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_contractors_org
--


CREATE INDEX idx_contractors_org ON public.contractors USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_contractors_trade
--


CREATE INDEX idx_contractors_trade ON public.contractors USING btree (organization_id, primary_trade) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_contractors_trades_gin
--


CREATE INDEX idx_contractors_trades_gin ON public.contractors USING gin (additional_trades);


--
-- INDEX: idx_deal_analyses_flip
--


CREATE INDEX idx_deal_analyses_flip ON public.deal_analyses USING btree (flip_id) WHERE (flip_id IS NOT NULL);


--
-- INDEX: idx_deal_analyses_org_pending
--


CREATE INDEX idx_deal_analyses_org_pending ON public.deal_analyses USING btree (organization_id) WHERE ((decision = 'pending'::text) AND (deleted_at IS NULL));


--
-- INDEX: idx_deal_analyses_property
--


CREATE INDEX idx_deal_analyses_property ON public.deal_analyses USING btree (property_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_feature_flags_lookup
--


CREATE INDEX idx_feature_flags_lookup ON public.feature_flags USING btree (organization_id, flag_key, is_enabled);


--
-- INDEX: idx_flip_revisions_flip
--


CREATE INDEX idx_flip_revisions_flip ON public.flip_revisions USING btree (flip_id);


--
-- INDEX: idx_flip_revisions_flip_number
--


CREATE UNIQUE INDEX idx_flip_revisions_flip_number ON public.flip_revisions USING btree (flip_id, revision_number);


--
-- INDEX: idx_flip_revisions_org
--


CREATE INDEX idx_flip_revisions_org ON public.flip_revisions USING btree (organization_id);


--
-- INDEX: idx_flip_stages_org
--


CREATE INDEX idx_flip_stages_org ON public.flip_stages USING btree (organization_id, sort_order) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_stages_org_slug
--


CREATE UNIQUE INDEX idx_flip_stages_org_slug ON public.flip_stages USING btree (organization_id, slug) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_team_flip
--


CREATE INDEX idx_flip_team_flip ON public.flip_team_members USING btree (flip_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_team_unique
--


CREATE UNIQUE INDEX idx_flip_team_unique ON public.flip_team_members USING btree (flip_id, user_id, role_in_flip) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_team_user
--


CREATE INDEX idx_flip_team_user ON public.flip_team_members USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_tx_budget_line
--


CREATE INDEX idx_flip_tx_budget_line ON public.flip_transactions USING btree (budget_line_id) WHERE ((budget_line_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- INDEX: idx_flip_tx_flip
--


CREATE INDEX idx_flip_tx_flip ON public.flip_transactions USING btree (flip_id, date DESC) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_tx_kind
--


CREATE INDEX idx_flip_tx_kind ON public.flip_transactions USING btree (flip_id, kind) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flip_tx_org
--


CREATE INDEX idx_flip_tx_org ON public.flip_transactions USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flips_active
--


CREATE INDEX idx_flips_active ON public.flips USING btree (organization_id) WHERE ((deleted_at IS NULL) AND (sold_at IS NULL) AND (killed_at IS NULL));


--
-- INDEX: idx_flips_org
--


CREATE INDEX idx_flips_org ON public.flips USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flips_org_code_unique
--


CREATE UNIQUE INDEX idx_flips_org_code_unique ON public.flips USING btree (organization_id, code) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flips_property
--


CREATE INDEX idx_flips_property ON public.flips USING btree (property_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_flips_stage
--


CREATE INDEX idx_flips_stage ON public.flips USING btree (stage_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_org_invitations_org
--


CREATE INDEX idx_org_invitations_org ON public.org_invitations USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_org_invitations_pending
--


CREATE UNIQUE INDEX idx_org_invitations_pending ON public.org_invitations USING btree (organization_id, email) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL) AND (deleted_at IS NULL));


--
-- INDEX: idx_org_invitations_token_hash
--


CREATE UNIQUE INDEX idx_org_invitations_token_hash ON public.org_invitations USING btree (token_hash) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_orgs_slug
--


CREATE INDEX idx_orgs_slug ON public.organizations USING btree (slug) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_orgs_stripe
--


CREATE INDEX idx_orgs_stripe ON public.organizations USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- INDEX: idx_projects_org
--


CREATE INDEX idx_projects_org ON public.projects USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_projects_org_name
--


CREATE UNIQUE INDEX idx_projects_org_name ON public.projects USING btree (organization_id, name) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_properties_contact
--


CREATE INDEX idx_properties_contact ON public.properties USING btree (contact_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_properties_location
--


CREATE INDEX idx_properties_location ON public.properties USING btree (province, district) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_properties_org
--


CREATE INDEX idx_properties_org ON public.properties USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_properties_project
--


CREATE INDEX idx_properties_project ON public.properties USING btree (project_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_properties_status
--


CREATE INDEX idx_properties_status ON public.properties USING btree (organization_id, sourcing_status) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_roles_org
--


CREATE INDEX idx_roles_org ON public.roles USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_roles_org_slug
--


CREATE UNIQUE INDEX idx_roles_org_slug ON public.roles USING btree (organization_id, slug) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_user_roles_org
--


CREATE INDEX idx_user_roles_org ON public.user_roles USING btree (organization_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_user_roles_unique_with_flip
--


CREATE UNIQUE INDEX idx_user_roles_unique_with_flip ON public.user_roles USING btree (organization_id, user_id, role_id, flip_id) WHERE ((flip_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- INDEX: idx_user_roles_unique_without_flip
--


CREATE UNIQUE INDEX idx_user_roles_unique_without_flip ON public.user_roles USING btree (organization_id, user_id, role_id) WHERE ((flip_id IS NULL) AND (deleted_at IS NULL));


--
-- INDEX: idx_user_roles_user
--


CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_users_email
--


CREATE INDEX idx_users_email ON public.users USING btree (email) WHERE (deleted_at IS NULL);


--
-- INDEX: idx_users_line
--


CREATE INDEX idx_users_line ON public.users USING btree (line_user_id) WHERE (line_user_id IS NOT NULL);


--
-- INDEX: uq_budget_cat_org_slug_live
--


CREATE UNIQUE INDEX uq_budget_cat_org_slug_live ON public.budget_categories USING btree (organization_id, slug) WHERE (deleted_at IS NULL);


--
-- TRIGGER: budget_categories set_budget_categories_updated_at
--


CREATE TRIGGER set_budget_categories_updated_at BEFORE UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: budget_lines set_budget_lines_updated_at
--


CREATE TRIGGER set_budget_lines_updated_at BEFORE UPDATE ON public.budget_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: contacts set_contacts_updated_at
--


CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: contractor_assignments set_contractor_assignments_updated_at
--


CREATE TRIGGER set_contractor_assignments_updated_at BEFORE UPDATE ON public.contractor_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: contractors set_contractors_updated_at
--


CREATE TRIGGER set_contractors_updated_at BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: deal_analyses set_deal_analyses_updated_at
--


CREATE TRIGGER set_deal_analyses_updated_at BEFORE UPDATE ON public.deal_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: feature_flags set_feature_flags_updated_at
--


CREATE TRIGGER set_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: flip_stages set_flip_stages_updated_at
--


CREATE TRIGGER set_flip_stages_updated_at BEFORE UPDATE ON public.flip_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: flip_transactions set_flip_transactions_updated_at
--


CREATE TRIGGER set_flip_transactions_updated_at BEFORE UPDATE ON public.flip_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: flips set_flips_updated_at
--


CREATE TRIGGER set_flips_updated_at BEFORE UPDATE ON public.flips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: org_invitations set_org_invitations_updated_at
--


CREATE TRIGGER set_org_invitations_updated_at BEFORE UPDATE ON public.org_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: organizations set_orgs_updated_at
--


CREATE TRIGGER set_orgs_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: projects set_projects_updated_at
--


CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: properties set_properties_updated_at
--


CREATE TRIGGER set_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: roles set_roles_updated_at
--


CREATE TRIGGER set_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: users set_users_updated_at
--


CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TRIGGER: flip_transactions trg_flip_tx_budget_actual
--


CREATE TRIGGER trg_flip_tx_budget_actual AFTER INSERT OR DELETE OR UPDATE ON public.flip_transactions FOR EACH ROW EXECUTE FUNCTION public.recompute_budget_line_actual();


--
-- FK CONSTRAINT: activity_log activity_log_organization_id_fkey
--


ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: activity_log activity_log_user_id_fkey
--


ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: budget_categories budget_categories_organization_id_fkey
--


ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: budget_categories budget_categories_parent_id_fkey
--


ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.budget_categories(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: budget_lines budget_lines_category_id_fkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.budget_categories(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: budget_lines budget_lines_created_by_fkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: budget_lines budget_lines_flip_id_fkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: budget_lines budget_lines_organization_id_fkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: budget_lines budget_lines_updated_by_fkey
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: contacts contacts_organization_id_fkey
--


ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_budget_category_id_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_budget_category_id_fkey FOREIGN KEY (budget_category_id) REFERENCES public.budget_categories(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_contractor_id_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_created_by_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_flip_id_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_organization_id_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: contractor_assignments contractor_assignments_updated_by_fkey
--


ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: contractors contractors_created_by_fkey
--


ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: contractors contractors_organization_id_fkey
--


ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: contractors contractors_updated_by_fkey
--


ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: deal_analyses deal_analyses_created_by_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: deal_analyses deal_analyses_decided_by_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: deal_analyses deal_analyses_flip_id_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: deal_analyses deal_analyses_organization_id_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: deal_analyses deal_analyses_property_id_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: deal_analyses deal_analyses_updated_by_fkey
--


ALTER TABLE ONLY public.deal_analyses
    ADD CONSTRAINT deal_analyses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: feature_flags feature_flags_organization_id_fkey
--


ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: budget_lines fk_budget_lines_contractor_assignment
--


ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT fk_budget_lines_contractor_assignment FOREIGN KEY (contractor_assignment_id) REFERENCES public.contractor_assignments(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: flip_code_counters flip_code_counters_organization_id_fkey
--


ALTER TABLE ONLY public.flip_code_counters
    ADD CONSTRAINT flip_code_counters_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_revisions flip_revisions_created_by_fkey
--


ALTER TABLE ONLY public.flip_revisions
    ADD CONSTRAINT flip_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: flip_revisions flip_revisions_flip_id_fkey
--


ALTER TABLE ONLY public.flip_revisions
    ADD CONSTRAINT flip_revisions_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_revisions flip_revisions_organization_id_fkey
--


ALTER TABLE ONLY public.flip_revisions
    ADD CONSTRAINT flip_revisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_stages flip_stages_organization_id_fkey
--


ALTER TABLE ONLY public.flip_stages
    ADD CONSTRAINT flip_stages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_team_members flip_team_members_assigned_by_fkey
--


ALTER TABLE ONLY public.flip_team_members
    ADD CONSTRAINT flip_team_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: flip_team_members flip_team_members_flip_id_fkey
--


ALTER TABLE ONLY public.flip_team_members
    ADD CONSTRAINT flip_team_members_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_team_members flip_team_members_organization_id_fkey
--


ALTER TABLE ONLY public.flip_team_members
    ADD CONSTRAINT flip_team_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_team_members flip_team_members_user_id_fkey
--


ALTER TABLE ONLY public.flip_team_members
    ADD CONSTRAINT flip_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_transactions flip_transactions_budget_line_id_fkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_budget_line_id_fkey FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: flip_transactions flip_transactions_created_by_fkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: flip_transactions flip_transactions_flip_id_fkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_flip_id_fkey FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_transactions flip_transactions_organization_id_fkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flip_transactions flip_transactions_updated_by_fkey
--


ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: flips flips_created_by_fkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: flips flips_organization_id_fkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: flips flips_property_id_fkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: flips flips_stage_id_fkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.flip_stages(id);


--
-- FK CONSTRAINT: flips flips_updated_by_fkey
--


ALTER TABLE ONLY public.flips
    ADD CONSTRAINT flips_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: org_invitations org_invitations_accepted_by_fkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: org_invitations org_invitations_invited_by_fkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: org_invitations org_invitations_organization_id_fkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: org_invitations org_invitations_revoked_by_fkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: org_invitations org_invitations_role_id_fkey
--


ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: projects projects_organization_id_fkey
--


ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: properties properties_contact_id_fkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: properties properties_created_by_fkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: properties properties_organization_id_fkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: properties properties_project_id_fkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- FK CONSTRAINT: properties properties_updated_by_fkey
--


ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: roles roles_organization_id_fkey
--


ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: user_roles user_roles_created_by_fkey
--


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- FK CONSTRAINT: user_roles user_roles_organization_id_fkey
--


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: user_roles user_roles_role_id_fkey
--


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: user_roles user_roles_user_id_fkey
--


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- ROW SECURITY: activity_log
--


ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: budget_categories
--


ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: budget_lines
--


ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: contacts
--


ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: contractor_assignments
--


ALTER TABLE public.contractor_assignments ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: contractors
--


ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: deal_analyses
--


ALTER TABLE public.deal_analyses ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: feature_flags
--


ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flip_code_counters
--


ALTER TABLE public.flip_code_counters ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flip_revisions
--


ALTER TABLE public.flip_revisions ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flip_stages
--


ALTER TABLE public.flip_stages ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flip_team_members
--


ALTER TABLE public.flip_team_members ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flip_transactions
--


ALTER TABLE public.flip_transactions ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: flips
--


ALTER TABLE public.flips ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: org_invitations
--


ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: organizations
--


ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: projects
--


ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: properties
--


ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: roles
--


ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: user_roles
--


ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


--
-- ROW SECURITY: users
--


ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

