'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';

export async function deleteDealAnalysis(dealAnalysisId: string): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.dealAnalysis.findFirst({
        where: { id: dealAnalysisId, organizationId: orgId, deletedAt: null },
        select: { id: true, propertyId: true },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      await tx.dealAnalysis.update({
        where: { id: dealAnalysisId },
        data: {
          deletedAt: new Date(),
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'deal_analysis',
        entityId: dealAnalysisId,
        action: 'deleted',
      });
    });

    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('deleteDealAnalysis failed', error);
    return { ok: false, error: 'server' };
  }
}
