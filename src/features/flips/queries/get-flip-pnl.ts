import 'server-only';

import { getFlipBudgetSummary } from '@/features/budget/queries/get-flip-budget-summary';
import { getFlipCashSummary } from '@/features/budget/queries/get-flip-cash-summary';
import { db } from '@/server/db';

export type FlipPnl = {
  flipId: string;
  flipType: 'float_flip' | 'transfer_in';
  sold: boolean;
  hasRevision: boolean;
  latestRevisionNumber: number | null;

  revenue: {
    plan: number;
    actual: number | null;
  };

  // Each row: planned magnitude from baseline/revision/deal_analysis, and
  // the actual magnitude from the ledger where tracked. Overheads that
  // aren't categorised in the budget yet report null for actual — we show
  // plan only and count them into projected cost so the math still balances.
  costs: {
    purchase: { plan: number | null; actual: number | null };
    renovation: { plan: number | null; actual: number };
    holding: { plan: number; actual: null };
    transaction: { plan: number; actual: null };
    selling: { plan: number; actual: null };
    marketing: { plan: number; actual: null };
    other: { plan: number; actual: null };
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

  const [latestRevision, dealAnalysis, budgetSummary, cashSummary] = await Promise.all([
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
    getFlipBudgetSummary(orgId, flipId),
    getFlipCashSummary(orgId, flipId),
  ]);

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
    flip.actualPurchasePriceThb != null ? Number(flip.actualPurchasePriceThb) : null;
  const actualRenovation = budgetSummary?.totalActualThb ?? 0;
  const actualSalePrice = flip.actualSalePriceThb != null ? Number(flip.actualSalePriceThb) : null;

  const totalPlanCost =
    (planPurchase ?? 0) +
    (planRenovation ?? 0) +
    planHolding +
    planTransaction +
    planSelling +
    planMarketing +
    planOther;

  // Tracked actuals: real purchase + budget rollup. Untracked overheads
  // (holding, transaction, selling, marketing, other) fall back to their
  // planned values for the projection since there's no per-category actual
  // tracking yet — flagged in the UI so operators know not to trust them
  // as "actual."
  const trackedActualSpend = (actualPurchase ?? planPurchase ?? 0) + actualRenovation;
  const untrackedPlanOverheads =
    planHolding + planTransaction + planSelling + planMarketing + planOther;
  const projectedTotalCost = trackedActualSpend + untrackedPlanOverheads;

  const plannedProfitThb = planArv - totalPlanCost;
  const projectedProfitThb = planArv - projectedTotalCost;
  const realizedProfitThb = actualSalePrice != null ? actualSalePrice - projectedTotalCost : null;

  return {
    flipId: flip.id,
    flipType,
    sold: flip.soldAt != null,
    hasRevision: latestRevision != null,
    latestRevisionNumber: latestRevision?.revisionNumber ?? null,

    revenue: { plan: planArv, actual: actualSalePrice },

    costs: {
      purchase: { plan: planPurchase, actual: actualPurchase },
      renovation: { plan: planRenovation, actual: actualRenovation },
      holding: { plan: planHolding, actual: null },
      transaction: { plan: planTransaction, actual: null },
      selling: { plan: planSelling, actual: null },
      marketing: { plan: planMarketing, actual: null },
      other: { plan: planOther, actual: null },
    },

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
