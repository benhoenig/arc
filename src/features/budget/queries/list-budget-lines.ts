import 'server-only';

import { db } from '@/server/db';

export async function listBudgetLinesForFlip(orgId: string, flipId: string) {
  const rows = await db.budgetLine.findMany({
    where: {
      organizationId: orgId,
      flipId,
      deletedAt: null,
    },
    select: {
      id: true,
      flipId: true,
      categoryId: true,
      description: true,
      budgetedAmountThb: true,
      committedAmountThb: true,
      actualAmountThb: true,
      notes: true,
      contractorAssignmentId: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: { id: true, slug: true, nameTh: true, nameEn: true, sortOrder: true },
      },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
  });

  return rows.map((row) => ({
    ...row,
    budgetedAmountThb: Number(row.budgetedAmountThb),
    committedAmountThb: Number(row.committedAmountThb),
    actualAmountThb: Number(row.actualAmountThb),
  }));
}

export type BudgetLineItem = Awaited<ReturnType<typeof listBudgetLinesForFlip>>[number];
