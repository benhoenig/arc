import 'server-only';

import { db } from '@/server/db';
import { computeUsageCost, type TokenUsage } from './pricing';

type RecordAiUsageParams = {
  orgId: string;
  userId: string | null;
  /** Defaults to 'anthropic'. */
  provider?: string;
  model: string;
  /** What spent the tokens, e.g. 'ocr_extraction'. */
  feature: string;
  usage: TokenUsage;
};

/**
 * Append one AI-usage event, with cost snapshotted at write time. Best-effort:
 * usage logging must never break the feature it measures, so failures are
 * swallowed (logged, not thrown).
 */
export async function recordAiUsage(params: RecordAiUsageParams): Promise<void> {
  const cost = computeUsageCost(params.model, params.usage);
  try {
    await db.aiUsageEvent.create({
      data: {
        organizationId: params.orgId,
        userId: params.userId,
        provider: params.provider ?? 'anthropic',
        model: params.model,
        feature: params.feature,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        cacheReadTokens: params.usage.cacheReadTokens ?? 0,
        cacheWriteTokens: params.usage.cacheWriteTokens ?? 0,
        costUsd: cost.costUsd,
        costThb: cost.costThb,
        usdToThb: cost.usdToThb,
      },
    });
  } catch (error) {
    console.error('recordAiUsage failed', error);
  }
}
