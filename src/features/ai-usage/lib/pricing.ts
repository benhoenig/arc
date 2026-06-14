import { env } from '@/lib/env';

/**
 * AI token pricing, used to value usage for display. USD per MILLION tokens.
 *
 * Source: Anthropic API standard pricing (verified 2026-06). Update here when
 * Anthropic changes rates — historical usage events snapshot their own cost, so
 * editing this only affects new events. A model missing from the table is still
 * logged (token counts), just with a zero cost (`priced: false`).
 */
const ANTHROPIC_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
};

// Reasonable mid-rate fallback when USD_TO_THB_RATE isn't set.
const DEFAULT_USD_TO_THB = 34;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type UsageCost = {
  costUsd: number;
  costThb: number;
  usdToThb: number;
  /** False when the model has no price entry — cost is 0 but tokens still log. */
  priced: boolean;
};

export function usdToThbRate(): number {
  return env.USD_TO_THB_RATE ?? DEFAULT_USD_TO_THB;
}

/**
 * Value a single call's token usage. Cache tokens (none in OCR today) are
 * approximated at the input rate — close enough for a usage meter.
 */
export function computeUsageCost(model: string, usage: TokenUsage): UsageCost {
  const usdToThb = usdToThbRate();
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) {
    return { costUsd: 0, costThb: 0, usdToThb, priced: false };
  }

  const inputTotal =
    usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  const costUsd =
    (inputTotal / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;

  return { costUsd, costThb: costUsd * usdToThb, usdToThb, priced: true };
}
