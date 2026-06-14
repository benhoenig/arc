import { z } from 'zod';
import { AI_MODEL_IDS } from '../lib/ai-models';

// Anthropic API keys are `sk-ant-...` and comfortably exceed 20 chars. We do a
// cheap shape check here; the real validation is whether Anthropic accepts it
// at extraction time. Trim first — pasted keys often carry trailing whitespace.
export const updateAiApiKeySchema = z.object({
  apiKey: z.string().trim().min(20, 'too_short').startsWith('sk-ant-', 'invalid_prefix'),
});

export const updateAiModelSchema = z.object({
  model: z.string().refine((m) => AI_MODEL_IDS.includes(m), { message: 'unknown_model' }),
});

// The operator pastes the credential blob from their local Claude Code login
// (the `{ claudeAiOauth: {...} }` JSON, or its inner object). Shape validation +
// token extraction happen server-side in parseSubscriptionCredential — here we
// only require non-empty input so the action can return a precise parse error.
export const updateAiSubscriptionSchema = z.object({
  credential: z.string().trim().min(1, 'required'),
});

export type UpdateAiApiKeyInput = z.infer<typeof updateAiApiKeySchema>;
export type UpdateAiModelInput = z.infer<typeof updateAiModelSchema>;
export type UpdateAiSubscriptionInput = z.infer<typeof updateAiSubscriptionSchema>;
