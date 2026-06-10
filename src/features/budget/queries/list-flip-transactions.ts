import 'server-only';

import { db } from '@/server/db';

type Options = {
  budgetLineId?: string;
  includeDeleted?: boolean;
};

export async function listTransactionsForFlip(
  orgId: string,
  flipId: string,
  options: Options = {},
) {
  const rows = await db.flipTransaction.findMany({
    where: {
      organizationId: orgId,
      flipId,
      ...(options.budgetLineId !== undefined ? { budgetLineId: options.budgetLineId } : {}),
      ...(options.includeDeleted ? {} : { deletedAt: null }),
    },
    select: {
      id: true,
      flipId: true,
      budgetLineId: true,
      date: true,
      amountThb: true,
      description: true,
      sourceNote: true,
      kind: true,
      receiptPath: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      budgetLine: {
        select: {
          id: true,
          description: true,
          category: { select: { id: true, slug: true, nameTh: true, nameEn: true } },
        },
      },
      createdByUser: { select: { id: true, fullName: true, displayName: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.map((row) => ({
    ...row,
    amountThb: Number(row.amountThb),
  }));
}

export type FlipTransactionItem = Awaited<ReturnType<typeof listTransactionsForFlip>>[number];

export async function listTransactionsForBudgetLine(
  orgId: string,
  budgetLineId: string,
): Promise<FlipTransactionItem[]> {
  const line = await db.budgetLine.findFirst({
    where: { id: budgetLineId, organizationId: orgId, deletedAt: null },
    select: { flipId: true },
  });
  if (!line) {
    return [];
  }
  return listTransactionsForFlip(orgId, line.flipId, { budgetLineId });
}
