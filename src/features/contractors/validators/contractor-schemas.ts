import { z } from 'zod';

export const CONTRACTOR_TYPES = ['individual', 'company'] as const;
export type ContractorType = (typeof CONTRACTOR_TYPES)[number];

export const CONTRACTOR_TRADES = [
  'general',
  'electrical',
  'plumbing',
  'flooring',
  'painting',
  'hvac',
  'other',
] as const;
export type ContractorTrade = (typeof CONTRACTOR_TRADES)[number];

export const PAYMENT_MODELS = ['fixed_milestone', 'time_materials'] as const;
export type PaymentModel = (typeof PAYMENT_MODELS)[number];

export const ASSIGNMENT_STATUSES = [
  'draft',
  'active',
  'completed',
  'canceled',
  'disputed',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// Legal status transitions. UI + action both enforce so a bad request never
// reaches the DB — the DB has no CHECK for transitions.
//
// No state is fully terminal: `canceled` and `completed` can be reverted
// because operators cancel/complete-by-mistake often enough that locking
// them out causes more pain than it prevents. Payments don't exist yet; if
// M6 introduces paid milestones against completed assignments, re-evaluate
// whether `completed → active` should require unwinding payments first.
const ASSIGNMENT_STATUS_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  draft: ['active', 'canceled'],
  active: ['completed', 'canceled', 'disputed'],
  disputed: ['active', 'canceled', 'completed'],
  completed: ['active', 'disputed'],
  canceled: ['draft', 'active'],
};

export function canTransitionAssignmentStatus(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  return ASSIGNMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

const rate = z.number().nonnegative().max(10_000_000);
const pct = z.number().nonnegative().max(100);
const amount = z.number().nonnegative().max(1_000_000_000);

export const createContractorSchema = z.object({
  name: z.string().min(1).max(200),
  contractorType: z.enum(CONTRACTOR_TYPES),
  primaryTrade: z.enum(CONTRACTOR_TRADES).optional(),
  additionalTrades: z.array(z.enum(CONTRACTOR_TRADES)).max(10).default([]),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  lineId: z.string().max(100).optional(),
  email: z
    .string()
    .email()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  defaultDailyRateThb: rate.optional(),
  defaultHourlyRateThb: rate.optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateContractorInput = z.input<typeof createContractorSchema>;

export const updateContractorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  contractorType: z.enum(CONTRACTOR_TYPES).optional(),
  primaryTrade: z.enum(CONTRACTOR_TRADES).nullable().optional(),
  additionalTrades: z.array(z.enum(CONTRACTOR_TRADES)).max(10).optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  lineId: z.string().max(100).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  taxId: z.string().max(50).nullable().optional(),
  defaultDailyRateThb: rate.nullable().optional(),
  defaultHourlyRateThb: rate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateContractorInput = z.input<typeof updateContractorSchema>;

export const deleteContractorSchema = z.object({ id: z.string().uuid() });

// Dates: accept ISO date strings from the UI, coerce to Date.
const dateInput = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'invalid_date' });

const assignmentBase = {
  flipId: z.string().uuid(),
  contractorId: z.string().uuid(),
  budgetCategoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  scopeOfWork: z.string().max(5000).optional(),
  startDate: dateInput.optional(),
  targetEndDate: dateInput.optional(),
  notes: z.string().max(2000).optional(),
};

// Discriminated union by payment_model. Matches the DB chk_payment_model_fields
// constraint: fixed_milestone needs contract_amount_thb; time_materials needs
// at least one of the rates. `progress_payment` was removed pre-launch — see
// migration 20260419105655_m5_drop_progress_payment_model.
export const createAssignmentSchema = z.discriminatedUnion('paymentModel', [
  z.object({
    ...assignmentBase,
    paymentModel: z.literal('fixed_milestone'),
    contractAmountThb: amount,
  }),
  z.object({
    ...assignmentBase,
    paymentModel: z.literal('time_materials'),
    tmDailyRateThb: rate.optional(),
    tmHourlyRateThb: rate.optional(),
    tmMaterialMarkupPct: pct.optional(),
  }),
]);
export type CreateAssignmentInput = z.input<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  id: z.string().uuid(),
  budgetCategoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  scopeOfWork: z.string().max(5000).nullable().optional(),
  startDate: dateInput.nullable().optional(),
  targetEndDate: dateInput.nullable().optional(),
  actualEndDate: dateInput.nullable().optional(),
  contractAmountThb: amount.optional(),
  tmDailyRateThb: rate.nullable().optional(),
  tmHourlyRateThb: rate.nullable().optional(),
  tmMaterialMarkupPct: pct.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateAssignmentInput = z.input<typeof updateAssignmentSchema>;

export const setAssignmentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ASSIGNMENT_STATUSES),
});
