/**
 * Curated Claude models offered for AI document extraction. Model names are
 * brand identifiers, not localized — kept as plain labels. Sonnet 4.6 is the
 * default (matches the OCR_MODEL env default): a strong vision model at a
 * reasonable cost for receipts/quotations.
 *
 * Adding a newly-released model is a one-line edit here — the validator derives
 * its allow-list from this list, so the two never drift.
 */
export const AI_MODEL_OPTIONS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', recommended: true },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', recommended: false },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', recommended: false },
] as const;

export type AiModelId = (typeof AI_MODEL_OPTIONS)[number]['id'];

export const AI_MODEL_IDS: readonly string[] = AI_MODEL_OPTIONS.map((m) => m.id);
