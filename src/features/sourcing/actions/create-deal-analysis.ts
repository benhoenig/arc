'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { computeDealFields, dealAnalysisSchema } from '../validators/sourcing-schemas';

export async function createDealAnalysis(
  input: Record<string, unknown>,
): Promise<ActionResult<{ dealAnalysisId: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = dealAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const computed = computeDealFields(parsed.data);

  try {
    const analysis = await db.$transaction(async (tx) => {
      const created = await tx.dealAnalysis.create({
        data: {
          organizationId: orgId,
          propertyId: parsed.data.propertyId,
          estPurchasePriceThb: parsed.data.estPurchasePriceThb,
          estRenovationCostThb: parsed.data.estRenovationCostThb,
          estHoldingCostThb: parsed.data.estHoldingCostThb,
          estTransactionCostThb: parsed.data.estTransactionCostThb,
          estSellingCostThb: parsed.data.estSellingCostThb,
          estArvThb: parsed.data.estArvThb,
          estTimelineDays: parsed.data.estTimelineDays,
          totalCostThb: computed.totalCostThb,
          estProfitThb: computed.estProfitThb,
          estMarginPct: computed.estMarginPct,
          estRoiPct: computed.estRoiPct,
          notes: parsed.data.notes,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'deal_analysis',
        entityId: created.id,
        action: 'created',
      });

      return created;
    });

    revalidatePath(`/sourcing/properties/${parsed.data.propertyId}`);
    return { ok: true, data: { dealAnalysisId: analysis.id } };
  } catch (error) {
    console.error('createDealAnalysis failed', error);
    return { ok: false, error: 'server' };
  }
}
