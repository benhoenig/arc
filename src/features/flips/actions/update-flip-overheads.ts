'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { computeDealFields } from '@/features/sourcing/validators/sourcing-schemas';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';

// Overhead plan values shown on the feasibility panel live on the flip's
// latest deal_analysis row — not on a feasibility-specific table. Editing them
// here keeps a single source of truth (no override layer) and routes through
// the same recompute the deal-analysis form uses. ARV / purchase / renovation
// are deliberately NOT editable from here: those change through the append-only
// re-underwriting (revision) flow so each change carries a reason + recompute.

const amount = z.number().finite().min(0).max(9_999_999_999);

const updateFlipOverheadsSchema = z.object({
  flipId: z.string().uuid(),
  holding: amount.optional(),
  transaction: amount.optional(),
  selling: amount.optional(),
  marketing: amount.optional(),
  other: amount.optional(),
});

const OVERHEAD_KEYS = ['holding', 'transaction', 'selling', 'marketing', 'other'] as const;

export async function updateFlipOverheads(
  input: Record<string, unknown>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateFlipOverheadsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { flipId, ...overheads } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: flipId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }

      const existing = await tx.dealAnalysis.findFirst({
        where: { flipId, organizationId: orgId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!existing) {
        throw new Error('no_deal_analysis');
      }

      const prev = {
        holding: Number(existing.estHoldingCostThb),
        transaction: Number(existing.estTransactionCostThb),
        selling: Number(existing.estSellingCostThb),
        marketing: Number(existing.marketingCostThb),
        other: Number(existing.otherCostThb),
      };

      // Build the audit diff (old → new) for only the fields that actually moved.
      const changes: Record<string, { from: number; to: number }> = {};
      for (const key of OVERHEAD_KEYS) {
        const next = overheads[key];
        if (next !== undefined && next !== prev[key]) {
          changes[key] = { from: prev[key], to: next };
        }
      }
      if (Object.keys(changes).length === 0) {
        return; // no-op — don't write or log audit noise
      }

      // Effective values: provided overrides win, untouched fields keep prior value.
      const eff = {
        holding: overheads.holding ?? prev.holding,
        transaction: overheads.transaction ?? prev.transaction,
        selling: overheads.selling ?? prev.selling,
        marketing: overheads.marketing ?? prev.marketing,
        other: overheads.other ?? prev.other,
      };

      const computed = computeDealFields({
        // deal_analysis owns its own flip_type (may differ from the flip after a
        // pivot); recompute against the DA's type, matching updateDealAnalysis.
        flipType: existing.flipType as 'float_flip' | 'transfer_in',
        estPurchasePriceThb: Number(existing.estPurchasePriceThb),
        estRenovationCostThb: Number(existing.estRenovationCostThb),
        estSellingCostThb: eff.selling,
        estArvThb: Number(existing.estArvThb),
        estHoldingCostThb: eff.holding,
        estTransactionCostThb: eff.transaction,
        depositAmountThb:
          existing.depositAmountThb != null ? Number(existing.depositAmountThb) : undefined,
        marketingCostThb: eff.marketing,
        otherCostThb: eff.other,
      });

      await tx.dealAnalysis.update({
        where: { id: existing.id },
        data: {
          estHoldingCostThb: eff.holding,
          estTransactionCostThb: eff.transaction,
          estSellingCostThb: eff.selling,
          marketingCostThb: eff.marketing,
          otherCostThb: eff.other,
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
        entityId: existing.id,
        action: 'overheads_updated',
        changes,
        context: { flipId },
      });
    });

    revalidatePath('/flips');
    revalidatePath(`/flips/${flipId}`);
    // The same deal_analysis row (recomputed above) is shown on /sourcing.
    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    if (error instanceof Error && error.message === 'no_deal_analysis') {
      return { ok: false, error: 'conflict', message: 'no_deal_analysis' };
    }
    console.error('updateFlipOverheads failed', error);
    return { ok: false, error: 'server' };
  }
}
