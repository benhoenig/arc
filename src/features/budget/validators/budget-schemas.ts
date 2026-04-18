import { z } from 'zod';

const amount = z.number().nonnegative().max(1_000_000_000);

export const createBudgetLineSchema = z.object({
  flipId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(500),
  budgetedAmountThb: amount.default(0),
  committedAmountThb: amount.default(0),
  actualAmountThb: amount.default(0),
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
  actualAmountThb: amount.optional(),
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

export const createBudgetCategorySchema = z.object({
  slug,
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;

export const updateBudgetCategorySchema = z.object({
  id: z.string().uuid(),
  slug: slug.optional(),
  nameTh: z.string().min(1).max(120).optional(),
  nameEn: z.string().min(1).max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type UpdateBudgetCategoryInput = z.infer<typeof updateBudgetCategorySchema>;

export const deleteBudgetCategorySchema = z.object({
  id: z.string().uuid(),
});
