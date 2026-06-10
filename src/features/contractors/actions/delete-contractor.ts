'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import { deleteContractorSchema } from '../validators/contractor-schemas';

export async function deleteContractor(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = deleteContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const contractor = await tx.contractor.findFirst({
        where: { id: parsed.data.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          _count: {
            select: {
              assignments: {
                where: { status: { in: ['draft', 'active'] }, deletedAt: null },
              },
            },
          },
        },
      });
      if (!contractor) {
        throw new Error('not_found');
      }
      // Block if contractor has live commitments — delete those first.
      if (contractor._count.assignments > 0) {
        throw new Error('conflict:has_active_assignments');
      }

      await tx.contractor.update({
        where: { id: contractor.id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor',
        entityId: contractor.id,
        action: 'deleted',
      });
    });

    revalidatePath('/contractors');
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
    console.error('deleteContractor failed', error);
    return { ok: false, error: 'server' };
  }
}
