'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { propertySchema } from '../validators/sourcing-schemas';

export async function createProperty(
  input: Record<string, unknown>,
): Promise<ActionResult<{ propertyId: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const property = await db.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          organizationId: orgId,
          ...parsed.data,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'property',
        entityId: created.id,
        action: 'created',
      });

      return created;
    });

    revalidatePath('/sourcing');
    revalidatePath('/sourcing/properties');
    return { ok: true, data: { propertyId: property.id } };
  } catch (error) {
    console.error('createProperty failed', error);
    return { ok: false, error: 'server' };
  }
}
