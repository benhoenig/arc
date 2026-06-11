import 'server-only';

import { getFlipCashSummary } from '@/features/budget/queries/get-flip-cash-summary';
import type { PnlBucket } from '@/features/budget/validators/budget-schemas';
import { db } from '@/server/db';

type CostRow = { plan: number | null; actual: number | null };

export type FlipPnl = {
  flipId: string;
  flipType: 'float_flip' | 'transfer_in';
  sold: boolean;
  hasRevision: boolean;
  hasDealAnalysis: boolean;
  latestRevisionNumber: number | null;

  revenue: {
    plan: number;
    actual: number | null;
  };

  // Each row: planned magnitude from baseline/revision/deal_analysis, and
  // the actual magnitude from budget categories mapped to a P&L bucket.
  // Buckets with no tracked budget lines report null for actual — we show
  // plan only and count the plan into projected cost so the math still balances.
  costs: {
    purchase: CostRow;
    renovation: CostRow;
    holding: CostRow;
    transaction: CostRow;
    selling: CostRow;
    marketing: CostRow;
    other: CostRow;
  };

  totalPlanCost: number;
  totalActualSpendThb: number; // renovation actual + actual purchase (tracked) only
  projectedTotalCost: number; // actual spend + remaining planned overheads (untracked categories)
  cashBalanceThb: number;
  transactionCount: number;

  // Profit + margin + ROI
  plannedProfitThb: number;
  plannedMarginPct: number | null;
  plannedRoiPct: number | null;
  projectedProfitThb: number;
  projectedMarginPct: number | null;
  projectedRoiPct: number | null;
  realizedProfitThb: number | null; // when sold
  realizedMarginPct: number | null;
  realizedRoiPct: number | null;
};

type PnlBucketSummaryRow = {
  pnl_bucket: PnlBucket;
  total_actual_thb: string | number;
  line_count: bigint | number;
};

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

export async function getFlipPnl(orgId: string, flipId: string): Promise<FlipPnl | null> {
  const flip = await db.flip.findFirst({
    where: { id: flipId, organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      flipType: true,
      soldAt: true,
      baselinePurchasePriceThb: true,
      baselineRenovationBudgetThb: true,
      baselineTargetArvThb: true,
      actualPurchasePriceThb: true,
      actualSalePriceThb: true,
    },
  });
  if (!flip) {
    return null;
  }

  const [latestRevision, dealAnalysis, cashSummary] = await Promise.all([
    db.flipRevision.findFirst({
      where: { flipId, organizationId: orgId },
      orderBy: { revisionNumber: 'desc' },
      select: {
        revisionNumber: true,
        revisedTargetArvThb: true,
        totalCapitalDeployedThb: true,
      },
    }),
    db.dealAnalysis.findFirst({
      where: { flipId, organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        estHoldingCostThb: true,
        estTransactionCostThb: true,
        estSellingCostThb: true,
        marketingCostThb: true,
        otherCostThb: true,
      },
    }),
    getFlipCashSummary(orgId, flipId),
  ]);

  const budgetBucketRows = await db.$queryRaw<PnlBucketSummaryRow[]>`
    SELECT bc.pnl_bucket,
           COALESCE(SUM(bl.actual_amount_thb), 0) AS total_actual_thb,
           COUNT(bl.id) FILTER (WHERE bl.deleted_at IS NULL) AS line_count
    FROM budget_categories bc
    JOIN budget_lines bl
      ON bl.category_id = bc.id
     AND bl.deleted_at IS NULL
    WHERE bl.flip_id = ${flipId}::uuid
      AND bl.organization_id = ${orgId}::uuid
      AND bc.organization_id = ${orgId}::uuid
      AND bc.deleted_at IS NULL
      AND bc.pnl_bucket <> 'exclude_from_pnl'
    GROUP BY bc.pnl_bucket
  `;

  const actualByBucket = new Map<PnlBucket, number | null>();
  for (const row of budgetBucketRows) {
    actualByBucket.set(
      row.pnl_bucket,
      Number(row.line_count) > 0 ? Number(row.total_actual_thb) : null,
    );
  }

  function bucketActual(bucket: PnlBucket): number | null {
    return actualByBucket.get(bucket) ?? null;
  }

  const flipType = flip.flipType as 'float_flip' | 'transfer_in';

  const planArv = Number(latestRevision?.revisedTargetArvThb ?? flip.baselineTargetArvThb ?? 0);
  const planPurchase =
    flip.baselinePurchasePriceThb != null ? Number(flip.baselinePurchasePriceThb) : null;
  const planRenovation =
    flip.baselineRenovationBudgetThb != null ? Number(flip.baselineRenovationBudgetThb) : null;
  const planHolding = dealAnalysis ? Number(dealAnalysis.estHoldingCostThb) : 0;
  const planTransaction = dealAnalysis ? Number(dealAnalysis.estTransactionCostThb) : 0;
  const planSelling = dealAnalysis ? Number(dealAnalysis.estSellingCostThb) : 0;
  const planMarketing = dealAnalysis ? Number(dealAnalysis.marketingCostThb) : 0;
  const planOther = dealAnalysis ? Number(dealAnalysis.otherCostThb) : 0;

  const actualPurchase =
    flip.actualPurchasePriceThb != null
      ? Number(flip.actualPurchasePriceThb)
      : bucketActual('purchase');
  const actualSalePrice = flip.actualSalePriceThb != null ? Number(flip.actualSalePriceThb) : null;

  const costs: FlipPnl['costs'] = {
    purchase: { plan: planPurchase, actual: actualPurchase },
    renovation: { plan: planRenovation, actual: bucketActual('renovation') },
    holding: { plan: planHolding, actual: bucketActual('holding') },
    transaction: { plan: planTransaction, actual: bucketActual('transaction') },
    selling: { plan: planSelling, actual: bucketActual('selling') },
    marketing: { plan: planMarketing, actual: bucketActual('marketing') },
    other: { plan: planOther, actual: bucketActual('other') },
  };

  const totalPlanCost =
    (planPurchase ?? 0) +
    (planRenovation ?? 0) +
    planHolding +
    planTransaction +
    planSelling +
    planMarketing +
    planOther;

  // Projected cost uses tracked actuals where a bucket has budget lines, and
  // falls back to the original plan where that bucket is not tracked yet.
  const projectedTotalCost = Object.values(costs).reduce(
    (sum, row) => sum + (row.actual ?? row.plan ?? 0),
    0,
  );
  const trackedActualSpend = Object.values(costs).reduce((sum, row) => sum + (row.actual ?? 0), 0);

  const plannedProfitThb = planArv - totalPlanCost;
  const projectedProfitThb = planArv - projectedTotalCost;
  const realizedProfitThb = actualSalePrice != null ? actualSalePrice - projectedTotalCost : null;

  return {
    flipId: flip.id,
    flipType,
    sold: flip.soldAt != null,
    hasRevision: latestRevision != null,
    hasDealAnalysis: dealAnalysis != null,
    latestRevisionNumber: latestRevision?.revisionNumber ?? null,

    revenue: { plan: planArv, actual: actualSalePrice },

    costs,

    totalPlanCost,
    totalActualSpendThb: trackedActualSpend,
    projectedTotalCost,
    cashBalanceThb: cashSummary?.cashBalanceThb ?? 0,
    transactionCount: cashSummary?.transactionCount ?? 0,

    plannedProfitThb,
    plannedMarginPct: pct(plannedProfitThb, planArv),
    plannedRoiPct: pct(plannedProfitThb, totalPlanCost),
    projectedProfitThb,
    projectedMarginPct: pct(projectedProfitThb, planArv),
    projectedRoiPct: pct(projectedProfitThb, projectedTotalCost),
    realizedProfitThb,
    realizedMarginPct:
      realizedProfitThb != null && actualSalePrice != null
        ? pct(realizedProfitThb, actualSalePrice)
        : null,
    realizedRoiPct: realizedProfitThb != null ? pct(realizedProfitThb, projectedTotalCost) : null,
  };
}
