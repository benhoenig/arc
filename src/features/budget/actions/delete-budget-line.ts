'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { deleteBudgetLineSchema } from '../validators/budget-schemas';

type Input = { id: string };

export async function deleteBudgetLine(input: Input): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = deleteBudgetLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const line = await tx.budgetLine.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: { id: true, flipId: true, flip: { select: { soldAt: true, killedAt: true } } },
      });
      if (!line) {
        throw new Error('not_found');
      }
      if (line.flip.killedAt || line.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      await tx.budgetLine.update({
        where: { id: line.id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_line',
        entityId: line.id,
        action: 'deleted',
      });

      return line.flipId;
    });

    revalidatePath(`/flips/${flipId}/budget`);
    revalidatePath(`/flips/${flipId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('deleteBudgetLine failed', error);
    return { ok: false, error: 'server' };
  }
}
