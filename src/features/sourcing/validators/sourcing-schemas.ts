import { z } from 'zod';

const optionalNumber = z.number().optional();

export const propertySchema = z.object({
  listingName: z.string().min(1).max(200),
  projectName: z.string().max(200).optional(),
  listingUrl: z.string().url().or(z.literal('')).optional(),
  propertyType: z.enum([
    'condo',
    'townhouse',
    'detached_house',
    'land',
    'commercial',
    'shophouse',
    'other',
  ]),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().nonnegative(),
  floorAreaSqm: z.number().nonnegative(),
  floors: z.number().int().positive(),
  floorLevel: optionalNumber,
  landAreaSqwa: optionalNumber,
  askingPriceThb: optionalNumber,
  priceRemark: z.string().max(500).optional(),
  contactType: z.enum(['seller', 'agent', 'owner', 'developer', 'other']).optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
  contactLineId: z.string().max(100).optional(),
  contactEmail: z.string().email().or(z.literal('')).optional(),
  notes: z.string().max(5000).optional(),
});

export const updatePropertySchema = propertySchema.partial().extend({
  id: z.string().uuid(),
});

// ── Deal Analysis ──────────────────────────────────────────────────

export const FLIP_TYPES = ['float_flip', 'transfer_in'] as const;
export type FlipType = (typeof FLIP_TYPES)[number];

export const dealAnalysisSchema = z.object({
  propertyId: z.string().uuid(),
  flipType: z.enum(FLIP_TYPES),

  // Shared: purchase/SPA price, reno, selling commission, target/ARV, timeline
  estPurchasePriceThb: z.number().positive(),
  estRenovationCostThb: z.number().nonnegative(),
  estSellingCostThb: z.number().nonnegative(),
  estArvThb: z.number().positive(),
  estTimelineDays: z.number().int().positive(),

  // Transfer-in only
  estHoldingCostThb: z.number().nonnegative().optional(),
  estTransactionCostThb: z.number().nonnegative().optional(),

  // Float-flip only
  depositAmountThb: z.number().nonnegative().optional(),
  contractMonths: z.number().int().positive().optional(),
  marketingCostThb: z.number().nonnegative().optional(),

  notes: z.string().max(5000).optional(),
});

export const dealDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['pursue', 'pass']),
  decisionNotes: z.string().max(2000).optional(),
});

// ── Compute helpers ────────────────────────────────────────────────

type DealInput = {
  flipType: FlipType;
  estPurchasePriceThb: number;
  estRenovationCostThb: number;
  estSellingCostThb: number;
  estArvThb: number;
  // Transfer-in
  estHoldingCostThb?: number;
  estTransactionCostThb?: number;
  // Float-flip
  depositAmountThb?: number;
  marketingCostThb?: number;
};

export function computeDealFields(input: DealInput) {
  if (input.flipType === 'float_flip') {
    // Float flip: capital deployed = deposit + reno + marketing + commission
    const deposit = input.depositAmountThb ?? 0;
    const reno = input.estRenovationCostThb;
    const marketing = input.marketingCostThb ?? 0;
    const commission = input.estSellingCostThb;

    const capitalDeployed = deposit + reno + marketing + commission;
    const profit = input.estArvThb - input.estPurchasePriceThb - reno - marketing - commission;
    const marginPct = input.estArvThb === 0 ? 0 : (profit / input.estArvThb) * 100;
    const roiPct = capitalDeployed === 0 ? 0 : (profit / capitalDeployed) * 100;

    return {
      totalCostThb: capitalDeployed,
      estProfitThb: profit,
      estMarginPct: marginPct,
      estRoiPct: roiPct,
    };
  }

  // Transfer in: traditional full-cost calculation
  const totalCostThb =
    input.estPurchasePriceThb +
    input.estRenovationCostThb +
    (input.estHoldingCostThb ?? 0) +
    (input.estTransactionCostThb ?? 0) +
    input.estSellingCostThb;

  const estProfitThb = input.estArvThb - totalCostThb;
  const estMarginPct = input.estArvThb === 0 ? 0 : (estProfitThb / input.estArvThb) * 100;
  const estRoiPct = totalCostThb === 0 ? 0 : (estProfitThb / totalCostThb) * 100;

  return { totalCostThb, estProfitThb, estMarginPct, estRoiPct };
}
