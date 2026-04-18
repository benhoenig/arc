'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { computeDealFields, updateDealAnalysisSchema } from '../validators/sourcing-schemas';

export async function updateDealAnalysis(
  input: Record<string, unknown>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateDealAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { id, propertyId: _propertyId, ...fields } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.dealAnalysis.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      // Recompute if any financial field changed
      const flipType = fields.flipType ?? existing.flipType;
      const mergedForCompute = {
        flipType: flipType as 'float_flip' | 'transfer_in',
        estPurchasePriceThb: fields.estPurchasePriceThb ?? Number(existing.estPurchasePriceThb),
        estRenovationCostThb: fields.estRenovationCostThb ?? Number(existing.estRenovationCostThb),
        estSellingCostThb: fields.estSellingCostThb ?? Number(existing.estSellingCostThb),
        estArvThb: fields.estArvThb ?? Number(existing.estArvThb),
        estHoldingCostThb: fields.estHoldingCostThb ?? Number(existing.estHoldingCostThb),
        estTransactionCostThb:
          fields.estTransactionCostThb ?? Number(existing.estTransactionCostThb),
        depositAmountThb:
          fields.depositAmountThb ??
          (existing.depositAmountThb != null ? Number(existing.depositAmountThb) : undefined),
        marketingCostThb: fields.marketingCostThb ?? Number(existing.marketingCostThb),
      };

      const computed = computeDealFields(mergedForCompute);

      await tx.dealAnalysis.update({
        where: { id },
        data: {
          ...fields,
          totalCostThb: computed.totalCostThb,
          estProfitThb: computed.estProfitThb,
          estMarginPct: computed.estMarginPct,
          estRoiPct: computed.estRoiPct,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'deal_analysis',
        entityId: id,
        action: 'updated',
      });
    });

    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('updateDealAnalysis failed', error);
    return { ok: false, error: 'server' };
  }
}
