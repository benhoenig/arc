import 'server-only';

import { db } from '@/server/db';

export async function listBudgetCategories(orgId: string) {
  const rows = await db.budgetCategory.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      sortOrder: true,
      isSystem: true,
      parentId: true,
      pnlBucket: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { nameTh: 'asc' }],
  });
  return rows;
}

export type BudgetCategoryItem = Awaited<ReturnType<typeof listBudgetCategories>>[number];
