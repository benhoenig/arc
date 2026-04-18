import { z } from 'zod';

const optionalNumber = z.preprocess(
  (v) => (v === '' || Number.isNaN(v) ? undefined : v),
  z.number().optional(),
);

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
  contactType: z.enum(['owner', 'agent', 'developer', 'other']).optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
  contactLineId: z.string().max(100).optional(),
  contactEmail: z.string().email().or(z.literal('')).optional(),
  notes: z.string().max(5000).optional(),
});

export const updatePropertySchema = propertySchema.partial().extend({
  id: z.string().uuid(),
});

// ── Contact ───────────────────────────────────────────────────────

export const CONTACT_TYPES = ['owner', 'agent', 'developer', 'other'] as const;

export const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  contactType: z.enum(CONTACT_TYPES),
  phone: z.string().max(50).optional(),
  lineId: z.string().max(100).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateContactSchema = createContactSchema.extend({
  id: z.string().uuid(),
});

// ── Project ───────────────────────────────────────────────────────

export const PROPERTY_TYPES = [
  'condo',
  'townhouse',
  'detached_house',
  'land',
  'commercial',
  'shophouse',
  'other',
] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  developer: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateProjectSchema = createProjectSchema.extend({
  id: z.string().uuid(),
});

// ── Deal Analysis ──────────────────────────────────────────────────

export const FLIP_TYPES = ['float_flip', 'transfer_in'] as const;
export type FlipType = (typeof FLIP_TYPES)[number];

export const dealAnalysisSchema = z.object({
  propertyId: z.string().uuid(),
  flipType: z.enum(FLIP_TYPES),
  label: z.string().max(100).optional(),

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

  // Both types
  otherCostThb: z.number().nonnegative().optional(),

  notes: z.string().max(5000).optional(),
});

export const updateDealAnalysisSchema = dealAnalysisSchema.partial().extend({
  id: z.string().uuid(),
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
  // Both types
  otherCostThb?: number;
};

export function computeDealFields(input: DealInput) {
  const other = input.otherCostThb ?? 0;

  if (input.flipType === 'float_flip') {
    // Float flip: capital deployed = deposit + reno + marketing + commission + other
    const deposit = input.depositAmountThb ?? 0;
    const reno = input.estRenovationCostThb;
    const marketing = input.marketingCostThb ?? 0;
    const commission = input.estSellingCostThb;

    const capitalDeployed = deposit + reno + marketing + commission + other;
    const profit =
      input.estArvThb - input.estPurchasePriceThb - reno - marketing - commission - other;
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
    input.estSellingCostThb +
    other;

  const estProfitThb = input.estArvThb - totalCostThb;
  const estMarginPct = input.estArvThb === 0 ? 0 : (estProfitThb / input.estArvThb) * 100;
  const estRoiPct = totalCostThb === 0 ? 0 : (estProfitThb / totalCostThb) * 100;

  return { totalCostThb, estProfitThb, estMarginPct, estRoiPct };
}
