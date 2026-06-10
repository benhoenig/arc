'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type CreateAssignmentInput,
  createAssignmentSchema,
} from '../validators/contractor-schemas';

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: data.flipId, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt || flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const contractor = await tx.contractor.findFirst({
        where: { id: data.contractorId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!contractor) {
        throw new Error('not_found');
      }

      if (data.budgetCategoryId) {
        const cat = await tx.budgetCategory.findFirst({
          where: { id: data.budgetCategoryId, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        if (!cat) {
          throw new Error('not_found');
        }
      }

      const paymentFields =
        data.paymentModel === 'time_materials'
          ? {
              tmDailyRateThb: data.tmDailyRateThb ?? null,
              tmHourlyRateThb: data.tmHourlyRateThb ?? null,
              tmMaterialMarkupPct: data.tmMaterialMarkupPct ?? null,
            }
          : { contractAmountThb: data.contractAmountThb };

      const assignment = await tx.contractorAssignment.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          contractorId: contractor.id,
          budgetCategoryId: data.budgetCategoryId ?? null,
          title: data.title,
          scopeOfWork: data.scopeOfWork ?? null,
          startDate: data.startDate ?? null,
          targetEndDate: data.targetEndDate ?? null,
          paymentModel: data.paymentModel,
          notes: data.notes ?? null,
          ...paymentFields,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_assignment',
        entityId: assignment.id,
        action: 'created',
        changes: {
          flipId: flip.id,
          contractorId: contractor.id,
          title: data.title,
          paymentModel: data.paymentModel,
        },
      });

      return assignment;
    });

    revalidatePath(`/flips/${data.flipId}/contractors`);
    revalidatePath(`/flips/${data.flipId}`);
    revalidatePath(`/contractors/${data.contractorId}`);
    return { ok: true, data: { id: result.id } };
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
    console.error('createAssignment failed', error);
    return { ok: false, error: 'server' };
  }
}
