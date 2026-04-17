'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { dealDecisionSchema } from '../validators/sourcing-schemas';

export async function recordDealDecision(
  input: z.infer<typeof dealDecisionSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = dealDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.dealAnalysis.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      await tx.dealAnalysis.update({
        where: { id: parsed.data.id },
        data: {
          decision: parsed.data.decision,
          decisionNotes: parsed.data.decisionNotes,
          decidedAt: new Date(),
          decidedBy: user.id,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'deal_analysis',
        entityId: parsed.data.id,
        action: `decision_${parsed.data.decision}`,
      });
    });

    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('recordDealDecision failed', error);
    return { ok: false, error: 'server' };
  }
}
