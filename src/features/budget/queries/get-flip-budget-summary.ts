import 'server-only';

import { db } from '@/server/db';

export type FlipBudgetSummary = {
  flipId: string;
  totalBudgetedThb: number;
  totalCommittedThb: number;
  totalActualThb: number;
  varianceThb: number;
  variancePct: number | null;
  lineCount: number;
};

type SummaryRow = {
  flip_id: string;
  organization_id: string;
  total_budgeted_thb: string | number;
  total_committed_thb: string | number;
  total_actual_thb: string | number;
  variance_thb: string | number;
  variance_pct: string | number | null;
  line_count: bigint | number;
};

// Reads from the flip_budget_summary Postgres view. RLS on the underlying
// budget_lines + flips tables scopes the result to the caller's org — the
// extra organization_id filter is belt-and-suspenders.
export async function getFlipBudgetSummary(
  orgId: string,
  flipId: string,
): Promise<FlipBudgetSummary | null> {
  const rows = await db.$queryRaw<SummaryRow[]>`
    SELECT flip_id, organization_id,
           total_budgeted_thb, total_committed_thb, total_actual_thb,
           variance_thb, variance_pct, line_count
    FROM flip_budget_summary
    WHERE flip_id = ${flipId}::uuid AND organization_id = ${orgId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    flipId: row.flip_id,
    totalBudgetedThb: Number(row.total_budgeted_thb),
    totalCommittedThb: Number(row.total_committed_thb),
    totalActualThb: Number(row.total_actual_thb),
    varianceThb: Number(row.variance_thb),
    variancePct: row.variance_pct == null ? null : Number(row.variance_pct),
    lineCount: Number(row.line_count),
  };
}
