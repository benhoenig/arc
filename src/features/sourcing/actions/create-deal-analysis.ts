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
          flipType: parsed.data.flipType,
          label: parsed.data.label || null,
          estPurchasePriceThb: parsed.data.estPurchasePriceThb,
          estRenovationCostThb: parsed.data.estRenovationCostThb,
          estSellingCostThb: parsed.data.estSellingCostThb,
          estArvThb: parsed.data.estArvThb,
          estTimelineDays: parsed.data.estTimelineDays,
          // Transfer-in fields
          estHoldingCostThb: parsed.data.estHoldingCostThb ?? 0,
          estTransactionCostThb: parsed.data.estTransactionCostThb ?? 0,
          // Float-flip fields
          depositAmountThb: parsed.data.depositAmountThb ?? null,
          contractMonths: parsed.data.contractMonths ?? null,
          marketingCostThb: parsed.data.marketingCostThb ?? 0,
          // Both types
          otherCostThb: parsed.data.otherCostThb ?? 0,
          // Computed
          totalCostThb: computed.totalCostThb,
          estProfitThb: computed.estProfitThb,
          estMarginPct: computed.estMarginPct,
          estRoiPct: computed.estRoiPct,
          notes: parsed.data.notes || null,
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
