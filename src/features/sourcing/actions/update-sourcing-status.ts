'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';

const SOURCING_STATUSES = [
  'new',
  'evaluating',
  'site_visit',
  'negotiating',
  'under_contract',
  'signed',
  'converted',
  'dropped',
] as const;

const schema = z.object({
  propertyId: z.string().uuid(),
  sourcingStatus: z.enum(SOURCING_STATUSES),
});

export async function updateSourcingStatus(
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.property.findFirst({
        where: { id: parsed.data.propertyId, organizationId: orgId, deletedAt: null },
        select: { id: true, sourcingStatus: true },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      if (existing.sourcingStatus === parsed.data.sourcingStatus) {
        return;
      }

      await tx.property.update({
        where: { id: parsed.data.propertyId },
        data: {
          sourcingStatus: parsed.data.sourcingStatus,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'property',
        entityId: parsed.data.propertyId,
        action: 'sourcing_status_changed',
        changes: {
          from: existing.sourcingStatus,
          to: parsed.data.sourcingStatus,
        },
      });
    });

    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('updateSourcingStatus failed', error);
    return { ok: false, error: 'server' };
  }
}
