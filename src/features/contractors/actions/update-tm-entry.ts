'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  computeTmLineTotal,
  type TmEntryType,
  type UpdateTmEntryInput,
  updateTmEntrySchema,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

export async function updateTmEntry(input: UpdateTmEntryInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateTmEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...fields } = parsed.data;

  try {
    const loc = await db.$transaction(async (tx) => {
      const e = await tx.contractorTmEntry.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          status: true,
          entryType: true,
          assignmentId: true,
          hoursWorked: true,
          daysWorked: true,
          appliedRateThb: true,
          materialCostThb: true,
          materialMarkupPct: true,
          assignment: {
            select: { flipId: true, flip: { select: { killedAt: true, soldAt: true } } },
          },
        },
      });
      if (!e) {
        throw new Error('not_found');
      }
      if (e.assignment.flip.killedAt || e.assignment.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      // Only editable while still pending/rejected — once approved it counts in
      // committed, and once paid it's settled. Reopen to pending to edit.
      if (e.status === 'approved' || e.status === 'paid') {
        throw new Error('conflict:entry_locked');
      }

      const entryType = e.entryType as TmEntryType;
      const isLabor = entryType === 'labor';
      const merged = {
        entryType,
        hoursWorked: isLabor ? pick(fields.hoursWorked, e.hoursWorked) : null,
        daysWorked: isLabor ? pick(fields.daysWorked, e.daysWorked) : null,
        appliedRateThb: isLabor ? pick(fields.appliedRateThb, e.appliedRateThb) : null,
        materialCostThb: isLabor ? null : pick(fields.materialCostThb, e.materialCostThb),
        materialMarkupPct: isLabor ? null : pick(fields.materialMarkupPct, e.materialMarkupPct),
      };
      const lineTotal = computeTmLineTotal(merged);

      await tx.contractorTmEntry.update({
        where: { id: e.id },
        data: {
          ...(fields.entryDate !== undefined ? { entryDate: fields.entryDate } : {}),
          ...(fields.description !== undefined ? { description: fields.description } : {}),
          ...(isLabor
            ? {
                ...(fields.hoursWorked !== undefined ? { hoursWorked: fields.hoursWorked } : {}),
                ...(fields.daysWorked !== undefined ? { daysWorked: fields.daysWorked } : {}),
                ...(fields.appliedRateThb !== undefined
                  ? { appliedRateThb: fields.appliedRateThb }
                  : {}),
              }
            : {
                ...(fields.materialCostThb !== undefined
                  ? { materialCostThb: fields.materialCostThb }
                  : {}),
                ...(fields.materialMarkupPct !== undefined
                  ? { materialMarkupPct: fields.materialMarkupPct }
                  : {}),
              }),
          ...(fields.receiptPath !== undefined ? { receiptPath: fields.receiptPath } : {}),
          ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
          lineTotalThb: lineTotal,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_tm_entry',
        entityId: e.id,
        action: 'updated',
        changes: { lineTotalThb: lineTotal },
      });

      return { flipId: e.assignment.flipId, assignmentId: e.assignmentId };
    });

    revalidatePath(`/flips/${loc.flipId}/contractors/${loc.assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'updateTmEntry');
  }
}

// Prefer the incoming field; null clears; undefined keeps the stored value.
function pick(incoming: number | null | undefined, stored: unknown): number | null {
  if (incoming === undefined) {
    return stored != null ? Number(stored) : null;
  }
  return incoming;
}
