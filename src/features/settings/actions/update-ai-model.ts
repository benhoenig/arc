'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import { type UpdateAiModelInput, updateAiModelSchema } from '../validators/ai-settings-schemas';

/**
 * Set the org's extraction model override. Admin-only. Stored independently of
 * the key, so a model can be chosen even while falling back to the env key.
 */
export async function updateAiModel(input: UpdateAiModelInput): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = updateAiModelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { model } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      await tx.orgAiSettings.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, model, createdBy: user.id, updatedBy: user.id },
        update: { model, updatedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_ai_settings',
        entityId: orgId,
        action: 'model_updated',
        changes: { model },
      });
    });

    revalidatePath('/settings/ai');
    return { ok: true, data: undefined };
  } catch (error) {
    console.error('updateAiModel failed', error);
    return { ok: false, error: 'server' };
  }
}
