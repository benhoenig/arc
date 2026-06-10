import { z } from 'zod';

export const TRANSACTION_KINDS = [
  'investor_deposit',
  'loan_disbursement',
  'spend',
  'refund',
  'sale_proceeds',
  'distribution',
] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

const OUTFLOW_KINDS = new Set<TransactionKind>(['spend', 'distribution']);
const NEEDS_BUDGET_LINE = new Set<TransactionKind>(['spend', 'refund']);

export function isOutflowKind(kind: TransactionKind): boolean {
  return OUTFLOW_KINDS.has(kind);
}

export function kindNeedsBudgetLine(kind: TransactionKind): boolean {
  return NEEDS_BUDGET_LINE.has(kind);
}

// UI sends a positive magnitude; the server applies the sign based on kind.
const positiveAmount = z.number().positive().max(1_000_000_000);

const dateSchema = z
  .union([z.string().min(1), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((date) => !Number.isNaN(date.getTime()), { message: 'invalid_date' });

const description = z.string().min(1).max(500);
const sourceNote = z.string().max(500);
const receiptPath = z.string().min(1).max(500);
const notes = z.string().max(2000);

// Discriminated union by `kind`. Outflow kinds (spend, refund) require a
// budget_line_id; inflow kinds require a source_note — which aligns with the
// DB CHECK constraints and reflects how the data will be audited.
export const createFlipTransactionSchema = z.discriminatedUnion('kind', [
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('spend'),
    budgetLineId: z.string().uuid(),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.optional(),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('refund'),
    budgetLineId: z.string().uuid(),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.optional(),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('investor_deposit'),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.min(1),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('loan_disbursement'),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.min(1),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('sale_proceeds'),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.optional(),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
  z.object({
    flipId: z.string().uuid(),
    kind: z.literal('distribution'),
    amountThb: positiveAmount,
    date: dateSchema,
    description,
    sourceNote: sourceNote.optional(),
    receiptPath: receiptPath.nullable().optional(),
    notes: notes.optional(),
  }),
]);
// `z.input` (not `z.infer`) so `date` can be a string in transit — Server
// Actions serialize args over the boundary and Date objects don't survive.
export type CreateFlipTransactionInput = z.input<typeof createFlipTransactionSchema>;

// Updates are partial — only fields that change are sent. `kind` is not
// editable (to change kind, delete + re-create; sign inversion is destructive).
export const updateFlipTransactionSchema = z.object({
  id: z.string().uuid(),
  budgetLineId: z.string().uuid().nullable().optional(),
  amountThb: positiveAmount.optional(),
  date: dateSchema.optional(),
  description: description.optional(),
  sourceNote: sourceNote.nullable().optional(),
  receiptPath: receiptPath.nullable().optional(),
  notes: notes.nullable().optional(),
});
export type UpdateFlipTransactionInput = z.input<typeof updateFlipTransactionSchema>;

export const deleteFlipTransactionSchema = z.object({
  id: z.string().uuid(),
});

// Magnitude → signed DB value, based on kind.
export function toSignedAmount(kind: TransactionKind, magnitude: number): number {
  return isOutflowKind(kind) ? -Math.abs(magnitude) : Math.abs(magnitude);
}
