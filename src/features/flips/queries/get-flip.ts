import 'server-only';

import { db } from '@/server/db';

export async function getFlipById(orgId: string, flipId: string) {
  const row = await db.flip.findFirst({
    where: { id: flipId, organizationId: orgId, deletedAt: null },
    include: {
      stage: true,
      property: {
        select: {
          id: true,
          listingName: true,
          thumbnailPath: true,
          propertyType: true,
          project: { select: { name: true } },
        },
      },
      teamMembers: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, fullName: true, displayName: true, email: true } },
        },
        orderBy: { assignedAt: 'asc' },
      },
      dealAnalyses: {
        where: { deletedAt: null },
        select: { id: true, createdAt: true, label: true, flipType: true, decision: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...row,
    baselinePurchasePriceThb:
      row.baselinePurchasePriceThb != null ? Number(row.baselinePurchasePriceThb) : null,
    baselineRenovationBudgetThb:
      row.baselineRenovationBudgetThb != null ? Number(row.baselineRenovationBudgetThb) : null,
    baselineTargetArvThb:
      row.baselineTargetArvThb != null ? Number(row.baselineTargetArvThb) : null,
    baselineTargetMarginPct:
      row.baselineTargetMarginPct != null ? Number(row.baselineTargetMarginPct) : null,
    actualPurchasePriceThb:
      row.actualPurchasePriceThb != null ? Number(row.actualPurchasePriceThb) : null,
    actualSalePriceThb: row.actualSalePriceThb != null ? Number(row.actualSalePriceThb) : null,
  };
}

export type FlipDetail = NonNullable<Awaited<ReturnType<typeof getFlipById>>>;
