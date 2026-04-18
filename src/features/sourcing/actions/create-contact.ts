'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { createContactSchema } from '../validators/sourcing-schemas';

export async function createContact(
  input: Record<string, unknown>,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          organizationId: orgId,
          name: parsed.data.name,
          contactType: parsed.data.contactType,
          phone: parsed.data.phone || null,
          lineId: parsed.data.lineId || null,
          email: parsed.data.email || null,
          notes: parsed.data.notes || null,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contact',
        entityId: created.id,
        action: 'created',
      });

      return created;
    });

    revalidatePath('/sourcing');
    return { ok: true, data: { contactId: contact.id } };
  } catch (error) {
    console.error('createContact failed', error);
    return { ok: false, error: 'server' };
  }
}
