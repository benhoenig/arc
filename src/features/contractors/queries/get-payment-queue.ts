import 'server-only';

import { db } from '@/server/db';

// The Contractor Manager's daily driver: all open (requested + approved)
// payments across the org, oldest first. Backs /contractors/payments.
export async function getPaymentQueue(orgId: string) {
  const rows = await db.contractorPayment.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { in: ['requested', 'approved'] },
    },
    select: {
      id: true,
      assignmentId: true,
      amountThb: true,
      status: true,
      requestedAt: true,
      approvedAt: true,
      milestoneId: true,
      contractor: { select: { id: true, name: true } },
      flip: { select: { id: true, code: true, name: true } },
      assignment: { select: { id: true, title: true, paymentModel: true } },
      milestone: { select: { id: true, title: true } },
    },
    orderBy: [{ requestedAt: 'asc' }],
  });

  return rows.map((r) => ({ ...r, amountThb: Number(r.amountThb) }));
}

export type PaymentQueueItem = Awaited<ReturnType<typeof getPaymentQueue>>[number];
