'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { createFlipSchema } from '../validators/flip-schemas';
import { allocateFlipCode } from './generate-flip-code';

export async function createFlip(
  input: z.infer<typeof createFlipSchema>,
): Promise<ActionResult<{ flipId: string; code: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createFlipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const deal = await tx.dealAnalysis.findFirst({
        where: {
          id: parsed.data.dealAnalysisId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: {
          id: true,
          propertyId: true,
          decision: true,
          flipId: true,
          estPurchasePriceThb: true,
          estRenovationCostThb: true,
          estArvThb: true,
          estMarginPct: true,
          estTimelineDays: true,
        },
      });

      if (!deal) {
        throw new Error('not_found');
      }
      if (deal.decision !== 'pursue') {
        throw new Error('conflict:not_pursued');
      }
      if (deal.flipId) {
        throw new Error('conflict:already_converted');
      }

      const stage = await tx.flipStage.findFirst({
        where: {
          organizationId: orgId,
          slug: parsed.data.startStageSlug,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!stage) {
        throw new Error('conflict:stage_missing');
      }

      const code = await allocateFlipCode(tx, orgId);

      const flip = await tx.flip.create({
        data: {
          organizationId: orgId,
          propertyId: deal.propertyId,
          code,
          name: parsed.data.name,
          stageId: stage.id,
          baselinePurchasePriceThb: deal.estPurchasePriceThb,
          baselineRenovationBudgetThb: deal.estRenovationCostThb,
          baselineTargetArvThb: deal.estArvThb,
          baselineTargetMarginPct: deal.estMarginPct,
          baselineTargetTimelineDays: deal.estTimelineDays,
          hasInvestorCapital: parsed.data.hasInvestorCapital,
          notes: parsed.data.notes ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      await tx.dealAnalysis.update({
        where: { id: deal.id },
        data: { flipId: flip.id, updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: 'created',
        context: { dealAnalysisId: deal.id, code },
      });

      return { id: flip.id, code };
    });

    revalidatePath('/flips');
    revalidatePath(`/flips/${result.id}`);
    revalidatePath('/sourcing');
    revalidatePath(`/sourcing/properties/${parsed.data.dealAnalysisId}`, 'page');
    return { ok: true, data: { flipId: result.id, code: result.code } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('createFlip failed', error);
    return { ok: false, error: 'server' };
  }
}
