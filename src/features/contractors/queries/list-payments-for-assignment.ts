import 'server-only';

import { db } from '@/server/db';

const paymentSelect = {
  id: true,
  assignmentId: true,
  contractorId: true,
  flipId: true,
  milestoneId: true,
  amountThb: true,
  paymentMethod: true,
  paymentReference: true,
  paidAt: true,
  requestedAt: true,
  approvedAt: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

function serialize<T extends { amountThb: unknown }>(r: T) {
  return { ...r, amountThb: Number(r.amountThb) };
}

export async function listPaymentsForAssignment(orgId: string, assignmentId: string) {
  const rows = await db.contractorPayment.findMany({
    where: { organizationId: orgId, assignmentId, deletedAt: null },
    select: { ...paymentSelect, milestone: { select: { id: true, title: true } } },
    orderBy: [{ requestedAt: 'desc' }],
  });
  return rows.map(serialize);
}

export async function listPaymentsForContractor(orgId: string, contractorId: string) {
  const rows = await db.contractorPayment.findMany({
    where: { organizationId: orgId, contractorId, deletedAt: null },
    select: {
      ...paymentSelect,
      flip: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ requestedAt: 'desc' }],
  });
  return rows.map(serialize);
}

export type AssignmentPaymentItem = Awaited<ReturnType<typeof listPaymentsForAssignment>>[number];
