'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import {
  computeFlipRevisionTotals,
  createFlipRevisionSchema,
  type RevisionComputeMode,
} from '../validators/flip-schemas';

/**
 * Records a pivot or re-underwriting event on a flip. Atomically:
 *  1. Verifies the flip is active (not sold/killed) and fetches its
 *     current flip_type to select the correct profit math.
 *  2. Allocates the next revision_number for this flip inside the tx.
 *  3. Computes totals via the shared helper so persisted numbers match
 *     what the UI previewed. Compute mode:
 *       - reunderwrite + float_flip    → float spread math
 *       - reunderwrite + transfer_in   → transfer math
 *       - pivot_to_transfer_in         → transfer math (and flip_type
 *         is switched to 'transfer_in' after commit so subsequent
 *         re-underwrites use transfer math too).
 *  4. Inserts the revision row with every input line for history.
 *  5. Updates the flip's baseline_* columns to the revised plan. For
 *     float re-underwrite, baseline_purchase_price stays the SPA
 *     contract price; reno budget becomes total planned reno. For
 *     pivot / transfer modes, baseline_purchase_price becomes the full
 *     acquisition cost (sunk deposit + remaining + transfer fees + loan).
 *  6. Sets has_investor_capital if any loan portion was used.
 *  7. Logs activity.
 */
export async function createFlipRevision(
  input: z.infer<typeof createFlipRevisionSchema>,
): Promise<ActionResult<{ revisionId: string; revisionNumber: number }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createFlipRevisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: {
          id: parsed.data.flipId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true, killedAt: true, soldAt: true, flipType: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt) {
        throw new Error('conflict:killed');
      }
      if (flip.soldAt) {
        throw new Error('conflict:sold');
      }
      if (parsed.data.revisionType === 'pivot_to_transfer_in' && flip.flipType !== 'float_flip') {
        throw new Error('conflict:pivot_not_applicable');
      }

      const latest = await tx.flipRevision.findFirst({
        where: { flipId: flip.id },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });
      const revisionNumber = (latest?.revisionNumber ?? 0) + 1;

      const mode: RevisionComputeMode =
        parsed.data.revisionType === 'pivot_to_transfer_in'
          ? 'pivot_to_transfer_in'
          : flip.flipType === 'float_flip'
            ? 'float_reunderwrite'
            : 'transfer_reunderwrite';

      // Normalize compute input: zero-default the fields that don't exist
      // for the current branch. The discriminated union validator already
      // shape-checked, so destructuring is safe here.
      const computeInput = {
        sunkDepositThb: parsed.data.sunkDepositThb,
        sunkRenoSpentThb: parsed.data.sunkRenoSpentThb,
        sunkMarketingSpentThb: parsed.data.sunkMarketingSpentThb,
        sunkOtherThb: parsed.data.sunkOtherThb,
        newRenoBudgetThb: parsed.data.newRenoBudgetThb,
        newMarketingBudgetThb:
          'newMarketingBudgetThb' in parsed.data ? parsed.data.newMarketingBudgetThb : 0,
        newCommissionThb: 'newCommissionThb' in parsed.data ? parsed.data.newCommissionThb : 0,
        newAdditionalDepositThb:
          'newAdditionalDepositThb' in parsed.data ? parsed.data.newAdditionalDepositThb : 0,
        newAdditionalExpenseThb:
          'newAdditionalExpenseThb' in parsed.data ? parsed.data.newAdditionalExpenseThb : 0,
        newRemainingPropertyCostThb:
          'newRemainingPropertyCostThb' in parsed.data
            ? parsed.data.newRemainingPropertyCostThb
            : 0,
        newTransferFeesCashThb:
          'newTransferFeesCashThb' in parsed.data ? parsed.data.newTransferFeesCashThb : 0,
        newTransferFeesLoanThb:
          'newTransferFeesLoanThb' in parsed.data ? parsed.data.newTransferFeesLoanThb : 0,
        newLoanOriginationThb:
          'newLoanOriginationThb' in parsed.data ? parsed.data.newLoanOriginationThb : 0,
        revisedTargetArvThb: parsed.data.revisedTargetArvThb,
        originalContractPriceThb:
          'originalContractPriceThb' in parsed.data
            ? parsed.data.originalContractPriceThb
            : undefined,
      };
      const totals = computeFlipRevisionTotals(mode, computeInput);

      const revision = await tx.flipRevision.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          revisionNumber,
          revisionType: parsed.data.revisionType,
          reasonNotes: parsed.data.reasonNotes ?? null,

          sunkDepositThb: computeInput.sunkDepositThb,
          sunkRenoSpentThb: computeInput.sunkRenoSpentThb,
          sunkMarketingSpentThb: computeInput.sunkMarketingSpentThb,
          sunkOtherThb: computeInput.sunkOtherThb,

          newRemainingPropertyCostThb: computeInput.newRemainingPropertyCostThb ?? 0,
          newTransferFeesCashThb: computeInput.newTransferFeesCashThb ?? 0,
          newTransferFeesLoanThb: computeInput.newTransferFeesLoanThb ?? 0,
          newLoanOriginationThb: computeInput.newLoanOriginationThb ?? 0,
          newRenoBudgetThb: computeInput.newRenoBudgetThb,
          newMarketingBudgetThb: computeInput.newMarketingBudgetThb ?? 0,
          newCommissionThb: computeInput.newCommissionThb ?? 0,
          newAdditionalDepositThb: computeInput.newAdditionalDepositThb ?? 0,
          newAdditionalExpenseThb: computeInput.newAdditionalExpenseThb ?? 0,

          originalContractPriceThb: computeInput.originalContractPriceThb ?? null,
          revisedTargetArvThb: computeInput.revisedTargetArvThb,
          revisedTargetTimelineDays: parsed.data.revisedTargetTimelineDays,

          totalCapitalDeployedThb: totals.totalCapitalDeployedThb,
          projectedProfitThb: totals.projectedProfitThb,
          projectedRoiPct: totals.projectedRoiPct,
          projectedMarginPct: totals.projectedMarginPct,
          walkAwayLossThb: totals.walkAwayLossThb,

          createdBy: user.id,
        },
      });

      // Map revision → flip baseline. Semantics differ by mode:
      //  - float re-underwrite: SPA price stays the baseline purchase; reno
      //    budget = total reno planned.
      //  - transfer re-underwrite / pivot: baseline purchase absorbs sunk +
      //    new acquisition capital so the overview reflects the full buy-in.
      const totalRenoPlanned = computeInput.sunkRenoSpentThb + computeInput.newRenoBudgetThb;

      let baselinePurchasePrice: number;
      if (mode === 'float_reunderwrite') {
        baselinePurchasePrice =
          computeInput.originalContractPriceThb ?? computeInput.sunkDepositThb;
      } else {
        baselinePurchasePrice =
          computeInput.sunkDepositThb +
          computeInput.sunkOtherThb +
          (computeInput.newRemainingPropertyCostThb ?? 0) +
          (computeInput.newTransferFeesCashThb ?? 0) +
          (computeInput.newTransferFeesLoanThb ?? 0) +
          (computeInput.newLoanOriginationThb ?? 0);
      }

      const usedLoan =
        (computeInput.newTransferFeesLoanThb ?? 0) > 0 ||
        (computeInput.newLoanOriginationThb ?? 0) > 0;

      await tx.flip.update({
        where: { id: flip.id },
        data: {
          baselinePurchasePriceThb: baselinePurchasePrice,
          baselineRenovationBudgetThb: totalRenoPlanned,
          baselineTargetArvThb: computeInput.revisedTargetArvThb,
          baselineTargetMarginPct: totals.projectedMarginPct,
          baselineTargetTimelineDays: parsed.data.revisedTargetTimelineDays,
          ...(usedLoan ? { hasInvestorCapital: true } : {}),
          ...(parsed.data.revisionType === 'pivot_to_transfer_in'
            ? { flipType: 'transfer_in' }
            : {}),
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: parsed.data.revisionType === 'pivot_to_transfer_in' ? 'pivoted' : 'revised',
        changes: {
          revisionNumber,
          revisionType: parsed.data.revisionType,
          mode,
          projectedProfitThb: totals.projectedProfitThb,
          totalCapitalDeployedThb: totals.totalCapitalDeployedThb,
        },
      });

      return { id: revision.id, revisionNumber };
    });

    revalidatePath('/flips');
    revalidatePath(`/flips/${parsed.data.flipId}`);
    return {
      ok: true,
      data: { revisionId: result.id, revisionNumber: result.revisionNumber },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('createFlipRevision failed', error);
    return { ok: false, error: 'server' };
  }
}
