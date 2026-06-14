'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type CreateTmEntryInput,
  computeTmLineTotal,
  createTmEntrySchema,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function createTmEntry(
  input: CreateTmEntryInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createTmEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const assignment = await tx.contractorAssignment.findFirst({
        where: { id: data.assignmentId, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          flipId: true,
          paymentModel: true,
          tmMaterialMarkupPct: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!assignment) {
        throw new Error('not_found');
      }
      if (assignment.flip.killedAt || assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      if (assignment.paymentModel !== 'time_materials') {
        throw new Error('conflict:wrong_payment_model');
      }

      const isLabor = data.entryType === 'labor';
      // Material markup falls back to the assignment's locked rate when blank.
      const materialMarkupPct = isLabor
        ? null
        : (data.materialMarkupPct ??
          (assignment.tmMaterialMarkupPct != null ? Number(assignment.tmMaterialMarkupPct) : 0));

      const lineTotal = computeTmLineTotal({
        entryType: data.entryType,
        hoursWorked: isLabor ? (data.hoursWorked ?? null) : null,
        daysWorked: isLabor ? (data.daysWorked ?? null) : null,
        appliedRateThb: isLabor ? data.appliedRateThb : null,
        materialCostThb: isLabor ? null : data.materialCostThb,
        materialMarkupPct,
      });

      const row = await tx.contractorTmEntry.create({
        data: {
          organizationId: orgId,
          assignmentId: assignment.id,
          entryType: data.entryType,
          entryDate: data.entryDate,
          description: data.description,
          hoursWorked: isLabor ? (data.hoursWorked ?? null) : null,
          daysWorked: isLabor ? (data.daysWorked ?? null) : null,
          appliedRateThb: isLabor ? data.appliedRateThb : null,
          materialCostThb: isLabor ? null : data.materialCostThb,
          materialMarkupPct,
          receiptPath: data.receiptPath ?? null,
          lineTotalThb: lineTotal,
          notes: data.notes ?? null,
          createdBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_tm_entry',
        entityId: row.id,
        action: 'created',
        changes: {
          assignmentId: assignment.id,
          entryType: data.entryType,
          lineTotalThb: lineTotal,
        },
      });

      return { id: row.id, flipId: assignment.flipId };
    });

    revalidatePath(`/flips/${result.flipId}/contractors/${data.assignmentId}`);
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return mapPaymentError(error, 'createTmEntry');
  }
}
