-- 0006_tasks_milestones.sql
-- M7 — Tasks & Timeline
--
-- Adds flip-level work tracking:
--   * tasks      (§7.1) — unit of work on a flip; assignable to a user, may
--                 reference a contractor assignment or a flip stage.
--   * milestones (§7.2) — major flip-level timeline checkpoints (target vs
--                 actual date). DISTINCT from contractor_milestones (M6).
--
-- Also extends the flip_portfolio_dashboard view (CREATE OR REPLACE) to expose
-- open_tasks_count + overdue_tasks_count for the portfolio dashboard (M11).
--
-- No rollup triggers needed — task/milestone counts are read live from the
-- view's correlated subqueries, not denormalised onto flips.
--
-- DATA_MODEL refs: §7.1 tasks, §7.2 milestones, §16 flip_portfolio_dashboard.

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: tasks  (§7.1)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
    id                    uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id       uuid NOT NULL,
    flip_id               uuid NOT NULL,
    title                 text NOT NULL,
    description           text,
    assigned_to_user_id   uuid,
    related_assignment_id uuid,
    flip_stage_id         uuid,
    priority              text DEFAULT 'normal'::text NOT NULL,
    status                text DEFAULT 'open'::text NOT NULL,
    due_date              date,
    completed_at          timestamp with time zone,
    completed_by          uuid,
    metadata              jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at            timestamp with time zone DEFAULT now() NOT NULL,
    updated_at            timestamp with time zone DEFAULT now() NOT NULL,
    created_by            uuid,
    updated_by            uuid,
    deleted_at            timestamp with time zone,
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT chk_task_priority CHECK ((priority = ANY (ARRAY[
        'low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT chk_task_status CHECK ((status = ANY (ARRAY[
        'open'::text, 'in_progress'::text, 'blocked'::text,
        'done'::text, 'canceled'::text])))
);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_flip_id_fkey
    FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_user_id_fkey
    FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_related_assignment_id_fkey
    FOREIGN KEY (related_assignment_id) REFERENCES public.contractor_assignments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_flip_stage_id_fkey
    FOREIGN KEY (flip_stage_id) REFERENCES public.flip_stages(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_fkey
    FOREIGN KEY (completed_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id);

CREATE INDEX idx_tasks_flip ON public.tasks
    USING btree (flip_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tasks_assignee ON public.tasks
    USING btree (assigned_to_user_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tasks_open ON public.tasks
    USING btree (organization_id, status)
    WHERE ((status = ANY (ARRAY['open'::text, 'in_progress'::text])) AND (deleted_at IS NULL));
CREATE INDEX idx_tasks_due ON public.tasks
    USING btree (due_date)
    WHERE ((status <> ALL (ARRAY['done'::text, 'canceled'::text])) AND (deleted_at IS NULL));

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE
    ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: milestones  (§7.2) — flip-level timeline checkpoints
-- ---------------------------------------------------------------------------
CREATE TABLE public.milestones (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    flip_id         uuid NOT NULL,
    title           text NOT NULL,
    description     text,
    sort_order      integer DEFAULT 0 NOT NULL,
    target_date     date NOT NULL,
    actual_date     date,
    is_critical     boolean DEFAULT false NOT NULL,
    metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at      timestamp with time zone DEFAULT now() NOT NULL,
    updated_at      timestamp with time zone DEFAULT now() NOT NULL,
    created_by      uuid,
    updated_by      uuid,
    deleted_at      timestamp with time zone,
    CONSTRAINT milestones_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_flip_id_fkey
    FOREIGN KEY (flip_id) REFERENCES public.flips(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id);

CREATE INDEX idx_milestones_flip ON public.milestones
    USING btree (flip_id, sort_order) WHERE (deleted_at IS NULL);
CREATE INDEX idx_milestones_upcoming ON public.milestones
    USING btree (target_date) WHERE ((actual_date IS NULL) AND (deleted_at IS NULL));

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_milestones_updated_at BEFORE UPDATE
    ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- VIEW: flip_portfolio_dashboard — extend with task aggregates (§16)
-- Mirrors the baseline definition; adds open_tasks_count + overdue_tasks_count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.flip_portfolio_dashboard AS
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
    ( SELECT count(*) AS count
           FROM public.tasks t
          WHERE ((t.flip_id = f.id)
                 AND (t.status = ANY (ARRAY['open'::text, 'in_progress'::text, 'blocked'::text]))
                 AND (t.deleted_at IS NULL))) AS open_tasks_count,
    ( SELECT count(*) AS count
           FROM public.tasks t
          WHERE ((t.flip_id = f.id)
                 AND (t.due_date < CURRENT_DATE)
                 AND (t.status <> ALL (ARRAY['done'::text, 'canceled'::text]))
                 AND (t.deleted_at IS NULL))) AS overdue_tasks_count,
    f.created_at,
    f.updated_at
   FROM (((public.flips f
     JOIN public.flip_stages s ON ((s.id = f.stage_id)))
     JOIN public.properties p ON ((p.id = f.property_id)))
     LEFT JOIN public.flip_budget_summary bs ON ((bs.flip_id = f.id)))
  WHERE (f.deleted_at IS NULL);

COMMIT;
