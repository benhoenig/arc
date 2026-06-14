'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  approvePaymentSchema,
  cancelPaymentSchema,
  rejectPaymentSchema,
} from '../validators/payment-schemas';
import { mapPaymentError } from './_payment-errors';

async function loadOpenPayment(tx: Prisma.TransactionClient, orgId: string, id: string) {
  const p = await tx.contractorPayment.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      status: true,
      flipId: true,
      assignmentId: true,
      flip: { select: { killedAt: true, soldAt: true } },
    },
  });
  if (!p) {
    throw new Error('not_found');
  }
  if (p.flip.killedAt || p.flip.soldAt) {
    throw new Error('conflict:flip_closed');
  }
  return p;
}

function revalidate(flipId: string, assignmentId: string) {
  revalidatePath(`/flips/${flipId}/contractors/${assignmentId}`);
  revalidatePath('/contractors/payments');
}

// requested → approved (authorizes money release; payment still unpaid).
export async function approvePayment(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = approvePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const loc = await db.$transaction(async (tx) => {
      const p = await loadOpenPayment(tx, orgId, parsed.data.id);
      if (p.status !== 'requested') {
        throw new Error('conflict:not_requested');
      }

      await tx.contractorPayment.update({
        where: { id: p.id },
        data: { status: 'approved', approvedAt: new Date(), approvedBy: user.id },
      });
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_payment',
        entityId: p.id,
        action: 'approved',
        changes: {},
      });
      return p;
    });

    revalidate(loc.flipId, loc.assignmentId);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'approvePayment');
  }
}

// requested|approved → rejected (no ledger effect — money never moved).
export async function rejectPayment(input: { id: string; notes?: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = rejectPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const loc = await db.$transaction(async (tx) => {
      const p = await loadOpenPayment(tx, orgId, parsed.data.id);
      if (p.status !== 'requested' && p.status !== 'approved') {
        throw new Error('conflict:not_open');
      }
      await tx.contractorPayment.update({
        where: { id: p.id },
        data: { status: 'rejected', notes: parsed.data.notes ?? null },
      });
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_payment',
        entityId: p.id,
        action: 'rejected',
        changes: {},
      });
      return p;
    });

    revalidate(loc.flipId, loc.assignmentId);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'rejectPayment');
  }
}

// requested|approved → canceled (withdrawn by the requester).
export async function cancelPayment(input: { id: string }): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = cancelPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const loc = await db.$transaction(async (tx) => {
      const p = await loadOpenPayment(tx, orgId, parsed.data.id);
      if (p.status !== 'requested' && p.status !== 'approved') {
        throw new Error('conflict:not_open');
      }
      await tx.contractorPayment.update({
        where: { id: p.id },
        data: { status: 'canceled' },
      });
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_payment',
        entityId: p.id,
        action: 'canceled',
        changes: {},
      });
      return p;
    });

    revalidate(loc.flipId, loc.assignmentId);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapPaymentError(error, 'cancelPayment');
  }
}
