import { z } from 'zod';

// Number fields use z.number() (not z.coerce.number()) because zod 4's coerce
// infers `unknown`, breaking react-hook-form's generic resolution. Form inputs
// use `valueAsNumber: true` via register options to handle string→number.
const optionalNumber = z.number().optional();

export const propertySchema = z.object({
  nickname: z.string().min(1).max(200),
  addressLine1: z.string().min(1).max(500),
  addressLine2: z.string().max(500).optional(),
  subdistrict: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  province: z.string().max(200).optional(),
  postalCode: z.string().max(10).optional(),
  propertyType: z.enum([
    'condo',
    'townhouse',
    'detached_house',
    'land',
    'commercial',
    'shophouse',
    'other',
  ]),
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  floorAreaSqm: optionalNumber,
  landAreaSqwa: optionalNumber,
  yearBuilt: optionalNumber,
  floors: optionalNumber,
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
