import { z } from 'zod';

const amount = z.number().nonnegative().max(1_000_000_000);

// `actualAmountThb` is no longer accepted on create/update (M4.5) — it's a
// trigger-maintained rollup of `flip_transactions`. To change actuals, add
// a transaction. Keeping the column out of the schema closes the back door.
export const createBudgetLineSchema = z.object({
  flipId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(500),
  budgetedAmountThb: amount.default(0),
  committedAmountThb: amount.default(0),
  notes: z.string().max(2000).optional(),
});
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>;

// Every field is optional so the UI can patch a single amount without
// resending the whole row. `id` identifies the line.
export const updateBudgetLineSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  description: z.string().min(1).max(500).optional(),
  budgetedAmountThb: amount.optional(),
  committedAmountThb: amount.optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>;

export const deleteBudgetLineSchema = z.object({
  id: z.string().uuid(),
});

const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'lower snake_case only');

export const PNL_BUCKETS = [
  'purchase',
  'renovation',
  'holding',
  'transaction',
  'selling',
  'marketing',
  'other',
  'exclude_from_pnl',
] as const;

export type PnlBucket = (typeof PNL_BUCKETS)[number];

const pnlBucket = z.enum(PNL_BUCKETS);

export const createBudgetCategorySchema = z.object({
  slug,
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  pnlBucket: pnlBucket.default('renovation'),
});
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;

// Names-only payload for inline creation from the budget-line dropdown. The
// slug and sort order are derived server-side (see createBudgetCategoryInline)
// so operators don't hand-type a snake_case slug mid-budget-entry. Full control
// over slug/sort order stays on the /settings/budget-categories page.
export const createBudgetCategoryInlineSchema = z.object({
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120).optional(),
});
export type CreateBudgetCategoryInlineInput = z.infer<typeof createBudgetCategoryInlineSchema>;

export const updateBudgetCategorySchema = z.object({
  id: z.string().uuid(),
  slug: slug.optional(),
  nameTh: z.string().min(1).max(120).optional(),
  nameEn: z.string().min(1).max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  pnlBucket: pnlBucket.optional(),
});
export type UpdateBudgetCategoryInput = z.infer<typeof updateBudgetCategorySchema>;

export const deleteBudgetCategorySchema = z.object({
  id: z.string().uuid(),
});
