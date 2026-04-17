import { z } from 'zod';

// Number fields use z.number() (not z.coerce.number()) because zod 4's coerce
// infers `unknown`, breaking react-hook-form's generic resolution. Form inputs
// handle string→number via valueAsNumber.

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
  floorLevel: z.number().int().positive().optional(),
  landAreaSqwa: z.number().nonnegative().optional(),
  askingPriceThb: z.number().nonnegative().optional(),
  priceRemark: z.string().max(500).optional(),
  // Contact (inline — auto-creates contact record)
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

export const dealAnalysisSchema = z.object({
  propertyId: z.string().uuid(),
  estPurchasePriceThb: z.number().positive(),
  estRenovationCostThb: z.number().nonnegative(),
  estHoldingCostThb: z.number().nonnegative(),
  estTransactionCostThb: z.number().nonnegative(),
  estSellingCostThb: z.number().nonnegative(),
  estArvThb: z.number().positive(),
  estTimelineDays: z.number().int().positive(),
  notes: z.string().max(5000).optional(),
});

export const dealDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['pursue', 'pass']),
  decisionNotes: z.string().max(2000).optional(),
});

export function computeDealFields(input: {
  estPurchasePriceThb: number;
  estRenovationCostThb: number;
  estHoldingCostThb: number;
  estTransactionCostThb: number;
  estSellingCostThb: number;
  estArvThb: number;
}) {
  const totalCostThb =
    input.estPurchasePriceThb +
    input.estRenovationCostThb +
    input.estHoldingCostThb +
    input.estTransactionCostThb +
    input.estSellingCostThb;

  const estProfitThb = input.estArvThb - totalCostThb;
  const estMarginPct = input.estArvThb === 0 ? 0 : (estProfitThb / input.estArvThb) * 100;
  const estRoiPct = totalCostThb === 0 ? 0 : (estProfitThb / totalCostThb) * 100;

  return { totalCostThb, estProfitThb, estMarginPct, estRoiPct };
}
