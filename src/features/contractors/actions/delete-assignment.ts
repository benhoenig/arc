'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';

// Soft-delete a contractor assignment. Only allowed while status='draft' —
// once an assignment is active or later, cancel it (status='canceled') to
// preserve the contract history. Completed/disputed/active assignments have
// downstream financial meaning that shouldn't vanish.
export async function deleteAssignment(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!input?.id || typeof input.id !== 'string') {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          contractorId: true,
          status: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      if (assignment.status !== 'draft') {
        throw new Error('conflict:only_drafts_deletable');
      }

      await tx.contractorAssignment.update({
        where: { id: assignment.id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_assignment',
        entityId: assignment.id,
        action: 'deleted',
      });

      return { flipId: assignment.flipId, contractorId: assignment.contractorId };
    });

    revalidatePath(`/flips/${flipId.flipId}/contractors`);
    revalidatePath(`/flips/${flipId.flipId}`);
    revalidatePath(`/contractors/${flipId.contractorId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return {
          ok: false,
          error: 'conflict',
          message: error.message.slice('conflict:'.length),
        };
      }
    }
    console.error('deleteAssignment failed', error);
    return { ok: false, error: 'server' };
  }
}
