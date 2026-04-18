import 'server-only';

import { db } from '@/server/db';

export type CategoryBreakdownRow = {
  categoryId: string;
  slug: string;
  nameTh: string;
  nameEn: string | null;
  sortOrder: number;
  totalBudgetedThb: number;
  totalCommittedThb: number;
  totalActualThb: number;
  varianceThb: number;
  lineCount: number;
};

type RawRow = {
  category_id: string;
  slug: string;
  name_th: string;
  name_en: string | null;
  sort_order: number;
  total_budgeted_thb: string | number;
  total_committed_thb: string | number;
  total_actual_thb: string | number;
  variance_thb: string | number;
  line_count: bigint | number;
};

// Reads category_budget_summary (view). Only returns categories that have
// at least one non-deleted line for this flip.
export async function getCategoryBreakdownForFlip(
  orgId: string,
  flipId: string,
): Promise<CategoryBreakdownRow[]> {
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT category_id, slug, name_th, name_en, sort_order,
           total_budgeted_thb, total_committed_thb, total_actual_thb,
           variance_thb, line_count
    FROM category_budget_summary
    WHERE flip_id = ${flipId}::uuid AND organization_id = ${orgId}::uuid
    ORDER BY sort_order ASC, name_th ASC
  `;

  return rows.map((row) => ({
    categoryId: row.category_id,
    slug: row.slug,
    nameTh: row.name_th,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    totalBudgetedThb: Number(row.total_budgeted_thb),
    totalCommittedThb: Number(row.total_committed_thb),
    totalActualThb: Number(row.total_actual_thb),
    varianceThb: Number(row.variance_thb),
    lineCount: Number(row.line_count),
  }));
}
