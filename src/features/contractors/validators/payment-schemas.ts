import { z } from 'zod';

// ============================================================================
// M6 — Contractor payments: milestones, T&M entries, payments.
// Status machines live here (single source of truth for legal transitions),
// mirroring the M5 canTransitionAssignmentStatus pattern.
// ============================================================================

const amount = z.number().nonnegative().max(1_000_000_000);
const positiveAmount = z.number().positive().max(1_000_000_000);
const pct = z.number().nonnegative().max(100);
const qty = z.number().positive().max(100_000);

const dateInput = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'invalid_date' });

// ---------------------------------------------------------------------------
// Milestones (fixed_milestone work)
// ---------------------------------------------------------------------------

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'approved',
  'paid',
  'disputed',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

// Manual transitions only. `paid` is set exclusively by markPaymentPaid (never
// via setMilestoneStatus), so it's terminal here and unreachable from the map.
const MILESTONE_STATUS_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  pending: ['in_progress', 'completed', 'disputed'],
  in_progress: ['completed', 'pending', 'disputed'],
  completed: ['approved', 'in_progress', 'disputed'],
  approved: ['completed'],
  disputed: ['pending', 'in_progress', 'completed'],
  paid: [],
};

export function canTransitionMilestoneStatus(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return MILESTONE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// A milestone can be billed once it's signed off as done.
export function milestoneIsBillable(status: MilestoneStatus): boolean {
  return status === 'completed' || status === 'approved';
}

export const createMilestoneSchema = z.object({
  assignmentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  amountThb: amount,
  percentage: pct.optional(),
  targetDate: dateInput.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  amountThb: amount.optional(),
  percentage: pct.nullable().optional(),
  targetDate: dateInput.nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;

export const setMilestoneStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(MILESTONE_STATUSES),
});

export const deleteMilestoneSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// T&M entries (time_materials work)
// ---------------------------------------------------------------------------

export const TM_ENTRY_TYPES = ['labor', 'material'] as const;
export type TmEntryType = (typeof TM_ENTRY_TYPES)[number];

export const TM_ENTRY_STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const;
export type TmEntryStatus = (typeof TM_ENTRY_STATUSES)[number];

const TM_ENTRY_STATUS_TRANSITIONS: Record<TmEntryStatus, TmEntryStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['rejected', 'pending'],
  rejected: ['pending'],
  paid: [],
};

export function canTransitionTmEntryStatus(from: TmEntryStatus, to: TmEntryStatus): boolean {
  return TM_ENTRY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// line_total = labor: rate × (days or hours); material: cost × (1 + markup%).
// Days take precedence over hours when both are present (a full-day entry).
export function computeTmLineTotal(input: {
  entryType: TmEntryType;
  hoursWorked?: number | null;
  daysWorked?: number | null;
  appliedRateThb?: number | null;
  materialCostThb?: number | null;
  materialMarkupPct?: number | null;
}): number {
  if (input.entryType === 'labor') {
    const rate = input.appliedRateThb ?? 0;
    const units = input.daysWorked ?? input.hoursWorked ?? 0;
    return round2(rate * units);
  }
  const cost = input.materialCostThb ?? 0;
  const markup = input.materialMarkupPct ?? 0;
  return round2(cost * (1 + markup / 100));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const tmEntryBase = {
  assignmentId: z.string().uuid(),
  entryDate: dateInput,
  description: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  receiptPath: z.string().min(1).max(500).nullable().optional(),
};

export const createTmEntrySchema = z.discriminatedUnion('entryType', [
  z.object({
    ...tmEntryBase,
    entryType: z.literal('labor'),
    appliedRateThb: positiveAmount,
    daysWorked: qty.optional(),
    hoursWorked: qty.optional(),
  }),
  z.object({
    ...tmEntryBase,
    entryType: z.literal('material'),
    materialCostThb: positiveAmount,
    materialMarkupPct: pct.optional(),
  }),
]);
export type CreateTmEntryInput = z.input<typeof createTmEntrySchema>;

export const updateTmEntrySchema = z.object({
  id: z.string().uuid(),
  entryDate: dateInput.optional(),
  description: z.string().min(1).max(500).optional(),
  appliedRateThb: positiveAmount.nullable().optional(),
  daysWorked: qty.nullable().optional(),
  hoursWorked: qty.nullable().optional(),
  materialCostThb: positiveAmount.nullable().optional(),
  materialMarkupPct: pct.nullable().optional(),
  receiptPath: z.string().min(1).max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateTmEntryInput = z.input<typeof updateTmEntrySchema>;

export const setTmEntryStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TM_ENTRY_STATUSES),
});

export const deleteTmEntrySchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const PAYMENT_STATUSES = ['requested', 'approved', 'paid', 'rejected', 'canceled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Request a payment against a single completed/approved milestone OR a batch
// of approved T&M entries for the assignment. The action resolves the amount
// server-side from the source, so no client-supplied amount here.
export const requestPaymentSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('milestone'),
    milestoneId: z.string().uuid(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    source: z.literal('tm_batch'),
    assignmentId: z.string().uuid(),
    notes: z.string().max(2000).optional(),
  }),
]);
export type RequestPaymentInput = z.input<typeof requestPaymentSchema>;

export const approvePaymentSchema = z.object({ id: z.string().uuid() });
export const rejectPaymentSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export const cancelPaymentSchema = z.object({ id: z.string().uuid() });

export const markPaymentPaidSchema = z.object({
  id: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentReference: z.string().max(200).optional(),
  paidAt: dateInput.optional(),
  notes: z.string().max(2000).optional(),
});
export type MarkPaymentPaidInput = z.input<typeof markPaymentPaidSchema>;
