import 'server-only';

import { db } from '@/server/db';

export async function listFlipRevisions(orgId: string, flipId: string) {
  const rows = await db.flipRevision.findMany({
    where: { organizationId: orgId, flipId },
    select: {
      id: true,
      revisionNumber: true,
      revisionType: true,
      reasonNotes: true,
      sunkDepositThb: true,
      sunkRenoSpentThb: true,
      sunkMarketingSpentThb: true,
      sunkOtherThb: true,
      newRemainingPropertyCostThb: true,
      newTransferFeesCashThb: true,
      newTransferFeesLoanThb: true,
      newLoanOriginationThb: true,
      newRenoBudgetThb: true,
      newMarketingBudgetThb: true,
      newCommissionThb: true,
      newAdditionalDepositThb: true,
      newAdditionalExpenseThb: true,
      originalContractPriceThb: true,
      revisedTargetArvThb: true,
      revisedTargetTimelineDays: true,
      totalCapitalDeployedThb: true,
      projectedProfitThb: true,
      projectedRoiPct: true,
      projectedMarginPct: true,
      walkAwayLossThb: true,
      createdAt: true,
      createdByUser: { select: { fullName: true, displayName: true, email: true } },
    },
    orderBy: { revisionNumber: 'desc' },
  });

  return rows.map((r) => ({
    ...r,
    sunkDepositThb: Number(r.sunkDepositThb),
    sunkRenoSpentThb: Number(r.sunkRenoSpentThb),
    sunkMarketingSpentThb: Number(r.sunkMarketingSpentThb),
    sunkOtherThb: Number(r.sunkOtherThb),
    newRemainingPropertyCostThb: Number(r.newRemainingPropertyCostThb),
    newTransferFeesCashThb: Number(r.newTransferFeesCashThb),
    newTransferFeesLoanThb: Number(r.newTransferFeesLoanThb),
    newLoanOriginationThb: Number(r.newLoanOriginationThb),
    newRenoBudgetThb: Number(r.newRenoBudgetThb),
    newMarketingBudgetThb: Number(r.newMarketingBudgetThb),
    newCommissionThb: Number(r.newCommissionThb),
    newAdditionalDepositThb: Number(r.newAdditionalDepositThb),
    newAdditionalExpenseThb: Number(r.newAdditionalExpenseThb),
    originalContractPriceThb:
      r.originalContractPriceThb != null ? Number(r.originalContractPriceThb) : null,
    revisedTargetArvThb: Number(r.revisedTargetArvThb),
    totalCapitalDeployedThb: Number(r.totalCapitalDeployedThb),
    projectedProfitThb: Number(r.projectedProfitThb),
    projectedRoiPct: Number(r.projectedRoiPct),
    projectedMarginPct: Number(r.projectedMarginPct),
    walkAwayLossThb: Number(r.walkAwayLossThb),
  }));
}

export type FlipRevisionItem = Awaited<ReturnType<typeof listFlipRevisions>>[number];
