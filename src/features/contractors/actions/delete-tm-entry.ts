'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { deleteTmEntrySchema } from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function deleteTmEntry(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = deleteTmEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id } = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
      const e = await tx.contractorTmEntry.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assignmentId: true,
          assignment: { select: { flipId: true } },
        },
      });
      if (!e) {
        throw new Error('not_found');
      }
      // A paid entry is settled in the ledger — can't be removed.
      if (e.status === 'paid') {
        throw new Error('conflict:entry_paid');
      }

      await tx.contractorTmEntry.update({
        where: { id: e.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_tm_entry',
        entityId: e.id,
        action: 'deleted',
        changes: {},
      });

      return { flipId: e.assignment.flipId, assignmentId: e.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'deleteTmEntry');
  }
}
