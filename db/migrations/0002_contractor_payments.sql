-- 0002_contractor_payments.sql
-- M6 — Contractor Payments
--
-- Adds the contractor payment lifecycle: milestones (fixed_milestone work),
-- T&M entries (time_materials work), and a unified payment queue with an
-- approval workflow.
--
-- Rollups (decided in the M6 plan):
--   * §14.3 contractor/assignment paid + committed totals  -> DB triggers here
--     (recompute-style, idempotent under soft-delete / status reversal).
--   * §14.4 budget-line actual sync                          -> APP CODE
--     (markPaymentPaid inserts a flip_transactions row kind='spend', which
--      fires the existing recompute_budget_line_actual trigger). No trigger
--      here for that path -- intentional deviation from DATA_MODEL §14.4's
--      "trigger" wording, to keep the flip_transactions insert (which needs
--      created_by / description) in the action.
--
-- DATA_MODEL refs: §6.3 contractor_milestones, §6.4 contractor_tm_entries,
-- §6.5 contractor_payments, §14.3 rollups.
--
-- NOTE: §6.4 spec'd `receipt_document_id uuid REFERENCES documents(id)`, but
-- the `documents` table does not exist until M11. We use `receipt_path text`
-- following the M4.5 Vercel Blob signed-URL pattern instead. Doc drift logged.

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: contractor_milestones  (§6.3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.contractor_milestones (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    assignment_id   uuid NOT NULL,
    title           text NOT NULL,
    sort_order      integer DEFAULT 0 NOT NULL,
    amount_thb      numeric(14,2) NOT NULL,
    percentage      numeric(5,2),
    target_date     date,
    completed_at    timestamp with time zone,
    completed_by    uuid,
    approved_at     timestamp with time zone,
    approved_by     uuid,
    status          text DEFAULT 'pending'::text NOT NULL,
    notes           text,
    created_at      timestamp with time zone DEFAULT now() NOT NULL,
    updated_at      timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at      timestamp with time zone,
    CONSTRAINT contractor_milestones_pkey PRIMARY KEY (id),
    CONSTRAINT chk_milestone_amount CHECK ((amount_thb >= (0)::numeric)),
    CONSTRAINT chk_milestone_status CHECK ((status = ANY (ARRAY[
        'pending'::text, 'in_progress'::text, 'completed'::text,
        'approved'::text, 'paid'::text, 'disputed'::text])))
);

ALTER TABLE ONLY public.contractor_milestones
    ADD CONSTRAINT contractor_milestones_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contractor_milestones
    ADD CONSTRAINT contractor_milestones_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.contractor_assignments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contractor_milestones
    ADD CONSTRAINT contractor_milestones_completed_by_fkey
    FOREIGN KEY (completed_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.contractor_milestones
    ADD CONSTRAINT contractor_milestones_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(id);

CREATE INDEX idx_milestones_assignment ON public.contractor_milestones
    USING btree (assignment_id, sort_order) WHERE (deleted_at IS NULL);
CREATE INDEX idx_milestones_pending_approval ON public.contractor_milestones
    USING btree (organization_id) WHERE ((status = 'completed'::text) AND (deleted_at IS NULL));

ALTER TABLE public.contractor_milestones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_contractor_milestones_updated_at BEFORE UPDATE
    ON public.contractor_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: contractor_tm_entries  (§6.4)
-- ---------------------------------------------------------------------------
CREATE TABLE public.contractor_tm_entries (
    id                  uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id     uuid NOT NULL,
    assignment_id       uuid NOT NULL,
    entry_type          text NOT NULL,
    entry_date          date NOT NULL,
    description         text NOT NULL,
    hours_worked        numeric(6,2),
    days_worked         numeric(6,2),
    applied_rate_thb    numeric(10,2),
    material_cost_thb   numeric(14,2),
    material_markup_pct numeric(5,2),
    receipt_path        text,
    line_total_thb      numeric(14,2) NOT NULL,
    status              text DEFAULT 'pending'::text NOT NULL,
    approved_at         timestamp with time zone,
    approved_by         uuid,
    notes               text,
    created_at          timestamp with time zone DEFAULT now() NOT NULL,
    updated_at          timestamp with time zone DEFAULT now() NOT NULL,
    created_by          uuid,
    deleted_at          timestamp with time zone,
    CONSTRAINT contractor_tm_entries_pkey PRIMARY KEY (id),
    CONSTRAINT chk_tm_entry_type CHECK ((entry_type = ANY (ARRAY['labor'::text, 'material'::text]))),
    CONSTRAINT chk_tm_status CHECK ((status = ANY (ARRAY[
        'pending'::text, 'approved'::text, 'rejected'::text, 'paid'::text]))),
    -- labor entries carry rate + (hours or days); material entries carry a cost
    CONSTRAINT chk_tm_entry_fields CHECK (
        ((entry_type = 'labor'::text)
            AND (applied_rate_thb IS NOT NULL)
            AND ((hours_worked IS NOT NULL) OR (days_worked IS NOT NULL)))
        OR ((entry_type = 'material'::text) AND (material_cost_thb IS NOT NULL)))
);

ALTER TABLE ONLY public.contractor_tm_entries
    ADD CONSTRAINT contractor_tm_entries_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contractor_tm_entries
    ADD CONSTRAINT contractor_tm_entries_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.contractor_assignments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contractor_tm_entries
    ADD CONSTRAINT contractor_tm_entries_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.contractor_tm_entries
    ADD CONSTRAINT contractor_tm_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);

CREATE INDEX idx_tm_assignment ON public.contractor_tm_entries
    USING btree (assignment_id, entry_date) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tm_pending ON public.contractor_tm_entries
    USING btree (organization_id) WHERE ((status = 'pending'::text) AND (deleted_at IS NULL));

ALTER TABLE public.contractor_tm_entries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_contractor_tm_entries_updated_at BEFORE UPDATE
    ON public.contractor_tm_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: contractor_payments  (§6.5)
-- ---------------------------------------------------------------------------
CREATE TABLE public.contractor_payments (
    id                uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id   uuid NOT NULL,
    assignment_id     uuid NOT NULL,
    contractor_id     uuid NOT NULL,
    flip_id           uuid NOT NULL,
    milestone_id      uuid,
    amount_thb        numeric(14,2) NOT NULL,
    payment_method    text,
    payment_reference text,
    paid_at           timestamp with time zone,
    requested_at      timestamp with time zone DEFAULT now() NOT NULL,
    requested_by      uuid,
    approved_at       timestamp with time zone,
    approved_by       uuid,
    status            text DEFAULT 'requested'::text NOT NULL,
    notes             text,
    metadata          jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at        timestamp with time zone,
    CONSTRAINT contractor_payments_pkey PRIMARY KEY (id),
    CONSTRAINT chk_payment_amount CHECK ((amount_thb > (0)::numeric)),
    CONSTRAINT chk_payment_status CHECK ((status = ANY (ARRAY[
        'requested'::text, 'approved'::text, 'paid'::text,
        'rejected'::text, 'canceled'::text]))),
    CONSTRAINT chk_payment_method CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY[
        'bank_transfer'::text, 'cash'::text, 'check'::text, 'other'::text])))),
    -- a paid payment must record when + how it was paid
    CONSTRAINT chk_payment_paid_fields CHECK (((status <> 'paid'::text)
        OR ((paid_at IS NOT NULL) AND (payment_method IS NOT NULL))))
);

ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.contractor_assignments(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_contractor_id_fkey
    FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_flip_id_fkey
    FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES public.contractor_milestones(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.contractor_payments
    ADD CONSTRAINT contractor_payments_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(id);

CREATE INDEX idx_payments_assignment ON public.contractor_payments
    USING btree (assignment_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_payments_contractor ON public.contractor_payments
    USING btree (contractor_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_payments_queue ON public.contractor_payments
    USING btree (organization_id, status)
    WHERE ((status = ANY (ARRAY['requested'::text, 'approved'::text])) AND (deleted_at IS NULL));
CREATE INDEX idx_payments_flip ON public.contractor_payments
    USING btree (flip_id) WHERE (deleted_at IS NULL);

ALTER TABLE public.contractor_payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_contractor_payments_updated_at BEFORE UPDATE
    ON public.contractor_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- FK: a paid contractor_payment may produce a flip_transactions row; tag it
-- back so we never double-emit a spend for the same payment (app-code guard
-- reads this column; column is nullable + unconstrained otherwise).
-- ---------------------------------------------------------------------------
ALTER TABLE public.flip_transactions
    ADD COLUMN contractor_payment_id uuid;
ALTER TABLE ONLY public.flip_transactions
    ADD CONSTRAINT flip_transactions_contractor_payment_id_fkey
    FOREIGN KEY (contractor_payment_id) REFERENCES public.contractor_payments(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX uq_flip_tx_contractor_payment ON public.flip_transactions
    USING btree (contractor_payment_id) WHERE (contractor_payment_id IS NOT NULL AND deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- §14.3 ROLLUP: contractor + assignment total_paid_thb
-- Recompute-style: SUM of non-deleted, status='paid' payments. Idempotent.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.recompute_contractor_paid() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_assignment_id uuid;
  v_contractor_id uuid;
BEGIN
  -- Recompute for every assignment / contractor touched by this row change.
  FOR v_assignment_id, v_contractor_id IN
    SELECT DISTINCT a, c FROM (VALUES
      (NEW.assignment_id, NEW.contractor_id),
      (OLD.assignment_id, OLD.contractor_id)
    ) AS t(a, c)
    WHERE a IS NOT NULL
  LOOP
    UPDATE contractor_assignments ca
    SET total_paid_thb = COALESCE((
      SELECT SUM(p.amount_thb)
      FROM contractor_payments p
      WHERE p.assignment_id = ca.id
        AND p.status = 'paid'
        AND p.deleted_at IS NULL
    ), 0)
    WHERE ca.id = v_assignment_id;

    UPDATE contractors c
    SET total_paid_thb = COALESCE((
      SELECT SUM(p.amount_thb)
      FROM contractor_payments p
      WHERE p.contractor_id = c.id
        AND p.status = 'paid'
        AND p.deleted_at IS NULL
    ), 0)
    WHERE c.id = v_contractor_id;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_contractor_payment_paid_rollup
    AFTER INSERT OR UPDATE OR DELETE ON public.contractor_payments
    FOR EACH ROW EXECUTE FUNCTION public.recompute_contractor_paid();

-- ---------------------------------------------------------------------------
-- §14.3 ROLLUP: assignment total_committed_thb
-- Recomputed from BOTH sources for the affected assignment:
--   fixed_milestone -> SUM(non-deleted milestone amounts)
--   time_materials  -> SUM(approved/paid T&M line totals)
-- One function attached to both source tables; always recomputes from both
-- so the two never race on the shared column.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.recompute_assignment_committed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_assignment_id uuid;
BEGIN
  FOR v_assignment_id IN
    SELECT DISTINCT a FROM (VALUES (NEW.assignment_id), (OLD.assignment_id)) AS t(a)
    WHERE a IS NOT NULL
  LOOP
    UPDATE contractor_assignments ca
    SET total_committed_thb =
      COALESCE((
        SELECT SUM(m.amount_thb)
        FROM contractor_milestones m
        WHERE m.assignment_id = ca.id AND m.deleted_at IS NULL
      ), 0)
      + COALESCE((
        SELECT SUM(e.line_total_thb)
        FROM contractor_tm_entries e
        WHERE e.assignment_id = ca.id
          AND e.status IN ('approved', 'paid')
          AND e.deleted_at IS NULL
      ), 0)
    WHERE ca.id = v_assignment_id;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_milestone_committed_rollup
    AFTER INSERT OR UPDATE OR DELETE ON public.contractor_milestones
    FOR EACH ROW EXECUTE FUNCTION public.recompute_assignment_committed();

CREATE TRIGGER trg_tm_entry_committed_rollup
    AFTER INSERT OR UPDATE OR DELETE ON public.contractor_tm_entries
    FOR EACH ROW EXECUTE FUNCTION public.recompute_assignment_committed();

COMMIT;
