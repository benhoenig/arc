import 'server-only';

import { db } from '@/server/db';

export type AiUsageSummary = {
  /** All-time cost in THB. */
  totalThb: number;
  /** Cost in THB since the start of the current month. */
  monthThb: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /** All-time number of model calls. */
  eventCount: number;
  /** Model calls this month. */
  monthEventCount: number;
};

/**
 * Aggregate an org's AI usage for the settings display. Reads the snapshotted
 * `cost_thb` on each event (so totals reflect the price/rate in effect when each
 * call happened). Month boundary is UTC — adequate for a usage meter.
 */
export async function getAiUsageSummary(orgId: string): Promise<AiUsageSummary> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [all, month] = await Promise.all([
    db.aiUsageEvent.aggregate({
      where: { organizationId: orgId },
      _sum: { costThb: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    db.aiUsageEvent.aggregate({
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
      _sum: { costThb: true },
      _count: true,
    }),
  ]);

  return {
    totalThb: Number(all._sum.costThb ?? 0),
    monthThb: Number(month._sum.costThb ?? 0),
    totalInputTokens: all._sum.inputTokens ?? 0,
    totalOutputTokens: all._sum.outputTokens ?? 0,
    eventCount: all._count,
    monthEventCount: month._count,
  };
}
