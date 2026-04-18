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
  'other',
] as const;
export type FlipKillReason = (typeof FLIP_KILL_REASONS)[number];

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

export const assignTeamMemberSchema = z.object({
  flipId: z.string().uuid(),
  userId: z.string().uuid(),
  roleInFlip: z.enum(FLIP_TEAM_ROLES),
});

export const removeTeamMemberSchema = z.object({
  flipId: z.string().uuid(),
  memberId: z.string().uuid(),
});
