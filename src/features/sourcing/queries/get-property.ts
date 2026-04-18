import 'server-only';

import { db } from '@/server/db';

export async function getProperty(orgId: string, propertyId: string) {
  const row = await db.property.findFirst({
    where: { id: propertyId, organizationId: orgId, deletedAt: null },
    include: {
      project: { select: { name: true } },
      contact: true,
      dealAnalyses: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!row) {
    return null;
  }

  // Convert Prisma Decimal objects to plain numbers for client serialization
  return {
    ...row,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : null,
    floorAreaSqm: row.floorAreaSqm != null ? Number(row.floorAreaSqm) : null,
    landAreaSqwa: row.landAreaSqwa != null ? Number(row.landAreaSqwa) : null,
    landAreaSqm: row.landAreaSqm != null ? Number(row.landAreaSqm) : null,
    askingPriceThb: row.askingPriceThb != null ? Number(row.askingPriceThb) : null,
    dealAnalyses: row.dealAnalyses.map((da) => ({
      ...da,
      estPurchasePriceThb: Number(da.estPurchasePriceThb),
      estRenovationCostThb: Number(da.estRenovationCostThb),
      estSellingCostThb: Number(da.estSellingCostThb),
      estArvThb: Number(da.estArvThb),
      estHoldingCostThb: Number(da.estHoldingCostThb),
      estTransactionCostThb: Number(da.estTransactionCostThb),
      depositAmountThb: da.depositAmountThb != null ? Number(da.depositAmountThb) : null,
      marketingCostThb: Number(da.marketingCostThb),
      totalCostThb: Number(da.totalCostThb),
      estProfitThb: Number(da.estProfitThb),
      estMarginPct: Number(da.estMarginPct),
      estRoiPct: Number(da.estRoiPct),
    })),
  };
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getProperty>>>;
