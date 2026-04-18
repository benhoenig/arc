'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { updateContactSchema } from '../validators/sourcing-schemas';

export async function updateContact(input: Record<string, unknown>): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { id, ...fields } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.contact.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      await tx.contact.update({
        where: { id },
        data: {
          ...fields,
          phone: fields.phone || null,
          lineId: fields.lineId || null,
          email: fields.email || null,
          notes: fields.notes || null,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contact',
        entityId: id,
        action: 'updated',
      });
    });

    revalidatePath('/sourcing');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('updateContact failed', error);
    return { ok: false, error: 'server' };
  }
}
