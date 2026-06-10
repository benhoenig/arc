'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type UpdateAssignmentInput,
  updateAssignmentSchema,
} from '../validators/contractor-schemas';

export async function updateAssignment(input: UpdateAssignmentInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...rest } = parsed.data;

  const keys = Object.keys(rest) as (keyof typeof rest)[];
  if (keys.length === 0) {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    const flipId = await db.$transaction(async (tx) => {
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          contractorId: true,
          paymentModel: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      // Fields incompatible with the assignment's payment model are rejected.
      if (rest.contractAmountThb !== undefined && assignment.paymentModel === 'time_materials') {
        throw new Error('conflict:wrong_payment_model');
      }
      if (
        (rest.tmDailyRateThb !== undefined ||
          rest.tmHourlyRateThb !== undefined ||
          rest.tmMaterialMarkupPct !== undefined) &&
        assignment.paymentModel !== 'time_materials'
      ) {
        throw new Error('conflict:wrong_payment_model');
      }

      if (rest.budgetCategoryId !== undefined && rest.budgetCategoryId !== null) {
        const cat = await tx.budgetCategory.findFirst({
          where: { id: rest.budgetCategoryId, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        if (!cat) {
          throw new Error('not_found');
        }
      }

      const data: Prisma.ContractorAssignmentUncheckedUpdateInput = { updatedBy: user.id };
      for (const k of keys) {
        if (rest[k] !== undefined) {
          // biome-ignore lint/suspicious/noExplicitAny: optional passthrough of validated partial
          (data as any)[k] = rest[k];
        }
      }

      await tx.contractorAssignment.update({
        where: { id: assignment.id },
        data,
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_assignment',
        entityId: assignment.id,
        action: 'updated',
        changes: rest as Prisma.InputJsonValue,
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
    console.error('updateAssignment failed', error);
    return { ok: false, error: 'server' };
  }
}
