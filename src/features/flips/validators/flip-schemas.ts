import { z } from 'zod';

export const FLIP_TEAM_ROLES = [
  'pm_lead',
  'sourcing_lead',
  'contractor_lead',
  'sales_lead',
  'contributor',
] as const;
export type FlipTeamRole = (typeof FLIP_TEAM_ROLES)[number];

export const FLIP_KILL_REASONS = [
  'pivoted_to_rental',
  'deal_collapsed',
  'market_change',
  'contract_expired',
  'other',
] as const;
export type FlipKillReason = (typeof FLIP_KILL_REASONS)[number];

export const FLIP_REVISION_TYPES = ['pivot_to_transfer_in', 'reunderwrite'] as const;
export type FlipRevisionType = (typeof FLIP_REVISION_TYPES)[number];

// Stages at which a new flip can be started. Terminal stages (sold, killed)
// are rejected; sourcing/underwriting are typically pre-flip on the deal side.
export const FLIP_CREATE_START_STAGES = [
  'negotiating',
  'acquiring',
  'renovating',
  'listing',
  'under_offer',
  'sold',
] as const;

const optionalNumber = z.preprocess(
  (v) => (v === '' || Number.isNaN(v) ? undefined : v),
  z.number().optional(),
);

export const createFlipSchema = z.object({
  dealAnalysisId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startStageSlug: z.enum(FLIP_CREATE_START_STAGES).default('acquiring'),
  hasInvestorCapital: z.boolean().default(false),
  notes: z.string().max(5000).optional(),
});

export const updateFlipSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  hasInvestorCapital: z.boolean().optional(),
  isOnHold: z.boolean().optional(),
  onHoldReason: z.string().max(500).nullable().optional(),
  actualPurchasePriceThb: optionalNumber,
  acquiredAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal('')),
  listedAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal('')),
  soldAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal('')),
  actualSalePriceThb: optionalNumber,
  notes: z.string().max(5000).nullable().optional(),
});

export const moveFlipToStageSchema = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
});

export const killFlipSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(FLIP_KILL_REASONS),
  notes: z.string().max(2000).optional(),
});

export const reviveFlipSchema = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
});

const nonNegNumber = z.number().nonnegative();

/**
 * Compute mode drives profit math. Re-underwriting a float flip uses
 * spread math (new sale price − original contract price); transfer-in
 * uses standard full-ARV math. Pivots convert from float to transfer-in
 * and therefore use transfer-in math going forward.
 */
export type RevisionComputeMode =
  | 'float_reunderwrite'
  | 'transfer_reunderwrite'
  | 'pivot_to_transfer_in';

/** Shared base: identifiers and notes. */
const revisionBaseShape = {
  flipId: z.string().uuid(),
  reasonNotes: z.string().max(2000).optional(),
  revisedTargetTimelineDays: z.number().int().positive(),
};

/**
 * Re-underwrite stays in the current strategy. The `original_contract_price`
 * is used only for float flips; it's captured as part of the snapshot so
 * history remains self-contained, and validation allows it either way.
 */
export const reunderwriteRevisionSchema = z.object({
  ...revisionBaseShape,
  revisionType: z.literal('reunderwrite'),

  // Sunk-so-far
  sunkDepositThb: nonNegNumber.default(0),
  sunkRenoSpentThb: nonNegNumber.default(0),
  sunkMarketingSpentThb: nonNegNumber.default(0),
  sunkOtherThb: nonNegNumber.default(0),

  // Additional spend going forward (no new property cost / transfer fees here —
  // that would be a pivot, which has its own schema).
  newRenoBudgetThb: nonNegNumber.default(0),
  newMarketingBudgetThb: nonNegNumber.default(0),
  newCommissionThb: nonNegNumber.default(0),

  // Float extension line items: additional deposit is refundable on success
  // (at-risk capital but not a cost); additional expense is a non-refundable
  // fee the owner demands as a condition of contract extension.
  newAdditionalDepositThb: nonNegNumber.default(0),
  newAdditionalExpenseThb: nonNegNumber.default(0),

  // Context for float-flip spread math (ignored for transfer_in).
  originalContractPriceThb: nonNegNumber.optional(),

  // Revised target exit price (ARV for transfer, buyer contract price for float).
  revisedTargetArvThb: z.number().positive(),
});

/** Pivot from float → transfer-in; adds acquisition and loan capital. */
export const pivotRevisionSchema = z.object({
  ...revisionBaseShape,
  revisionType: z.literal('pivot_to_transfer_in'),

  // Sunk from the abandoned float attempt.
  sunkDepositThb: nonNegNumber.default(0),
  sunkRenoSpentThb: nonNegNumber.default(0),
  sunkMarketingSpentThb: nonNegNumber.default(0),
  sunkOtherThb: nonNegNumber.default(0),

  // New capital to take transfer.
  newRemainingPropertyCostThb: nonNegNumber.default(0),
  newTransferFeesCashThb: nonNegNumber.default(0),
  newTransferFeesLoanThb: nonNegNumber.default(0),
  newLoanOriginationThb: nonNegNumber.default(0),
  newRenoBudgetThb: nonNegNumber.default(0),

  // Revised ARV after transfer & reno.
  revisedTargetArvThb: z.number().positive(),
});

export const createFlipRevisionSchema = z.discriminatedUnion('revisionType', [
  reunderwriteRevisionSchema,
  pivotRevisionSchema,
]);

// Shared input for compute. All fields default to 0 so the same signature
// serves re-underwrite (ignores pivot-only fields) and pivot (ignores
// float-spread fields) without noisy branching at call sites.
export type RevisionComputeInput = {
  // Sunk
  sunkDepositThb: number;
  sunkRenoSpentThb: number;
  sunkMarketingSpentThb: number;
  sunkOtherThb: number;
  // Going forward — re-underwrite
  newRenoBudgetThb: number;
  newMarketingBudgetThb?: number;
  newCommissionThb?: number;
  // Float extension line items (used only by float_reunderwrite). Additional
  // deposit is refundable on success — at-risk capital, not a cost. Additional
  // expense is non-refundable — subtracts from profit.
  newAdditionalDepositThb?: number;
  newAdditionalExpenseThb?: number;
  // Going forward — pivot only
  newRemainingPropertyCostThb?: number;
  newTransferFeesCashThb?: number;
  newTransferFeesLoanThb?: number;
  newLoanOriginationThb?: number;
  // Targets
  revisedTargetArvThb: number;
  // Float spread context
  originalContractPriceThb?: number;
};

export function computeFlipRevisionTotals(mode: RevisionComputeMode, input: RevisionComputeInput) {
  const sunkTotal =
    input.sunkDepositThb +
    input.sunkRenoSpentThb +
    input.sunkMarketingSpentThb +
    input.sunkOtherThb;

  // Walk-away loss is always everything sunk — true for any mode.
  const walkAwayLossThb = sunkTotal;

  if (mode === 'float_reunderwrite') {
    // Float flip: you don't take title, so profit = (new sale price − original
    // contract price) − incremental reno/marketing/commission/other − any
    // non-refundable extension fees. Additional deposit is refundable on
    // success and therefore does NOT subtract from profit, but it does count
    // toward capital-at-risk for ROI and toward walk-away loss.
    const totalRenoThb = input.sunkRenoSpentThb + input.newRenoBudgetThb;
    const totalMarketingThb = input.sunkMarketingSpentThb + (input.newMarketingBudgetThb ?? 0);
    const commissionThb = input.newCommissionThb ?? 0;
    const additionalDeposit = input.newAdditionalDepositThb ?? 0;
    const additionalExpense = input.newAdditionalExpenseThb ?? 0;
    const originalContract = input.originalContractPriceThb ?? 0;

    const spread = input.revisedTargetArvThb - originalContract;
    const projectedProfitThb =
      spread -
      totalRenoThb -
      totalMarketingThb -
      commissionThb -
      input.sunkOtherThb -
      additionalExpense;

    const totalCapitalDeployedThb =
      input.sunkDepositThb +
      totalRenoThb +
      totalMarketingThb +
      commissionThb +
      input.sunkOtherThb +
      additionalDeposit +
      additionalExpense;

    const projectedMarginPct =
      input.revisedTargetArvThb === 0 ? 0 : (projectedProfitThb / input.revisedTargetArvThb) * 100;
    const projectedRoiPct =
      totalCapitalDeployedThb === 0 ? 0 : (projectedProfitThb / totalCapitalDeployedThb) * 100;

    // Net cash in = everything new you still need to spend going forward.
    const newCapitalTotal =
      input.newRenoBudgetThb +
      (input.newMarketingBudgetThb ?? 0) +
      commissionThb +
      additionalDeposit +
      additionalExpense;

    // Walk-away stays as sunk only — it represents abandoning the deal NOW
    // without committing to the extension, so the user can compare against
    // the extended scenario cleanly.
    return {
      sunkTotal,
      newCapitalTotal,
      totalCapitalDeployedThb,
      projectedProfitThb,
      projectedRoiPct,
      projectedMarginPct,
      walkAwayLossThb,
    };
  }

  // transfer_reunderwrite and pivot_to_transfer_in share full-ARV math —
  // profit = ARV − total capital deployed (everything in). The only
  // difference is which "new capital" line items apply; both are summed here.
  const newCapitalTotal =
    (input.newRemainingPropertyCostThb ?? 0) +
    (input.newTransferFeesCashThb ?? 0) +
    (input.newTransferFeesLoanThb ?? 0) +
    (input.newLoanOriginationThb ?? 0) +
    input.newRenoBudgetThb +
    (input.newMarketingBudgetThb ?? 0) +
    (input.newCommissionThb ?? 0);

  const totalCapitalDeployedThb = sunkTotal + newCapitalTotal;
  const projectedProfitThb = input.revisedTargetArvThb - totalCapitalDeployedThb;
  const projectedMarginPct =
    input.revisedTargetArvThb === 0 ? 0 : (projectedProfitThb / input.revisedTargetArvThb) * 100;
  const projectedRoiPct =
    totalCapitalDeployedThb === 0 ? 0 : (projectedProfitThb / totalCapitalDeployedThb) * 100;

  return {
    sunkTotal,
    newCapitalTotal,
    totalCapitalDeployedThb,
    projectedProfitThb,
    projectedRoiPct,
    projectedMarginPct,
    walkAwayLossThb,
  };
}

export const assignTeamMemberSchema = z.object({
  flipId: z.string().uuid(),
  userId: z.string().uuid(),
  roleInFlip: z.enum(FLIP_TEAM_ROLES),
});

export const removeTeamMemberSchema = z.object({
  flipId: z.string().uuid(),
  memberId: z.string().uuid(),
});
