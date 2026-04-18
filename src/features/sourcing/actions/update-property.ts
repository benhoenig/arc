'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { updatePropertySchema } from '../validators/sourcing-schemas';

export async function updateProperty(input: Record<string, unknown>): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updatePropertySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const {
    id,
    projectName,
    contactName,
    contactType,
    contactPhone,
    contactLineId,
    contactEmail,
    ...propertyFields
  } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.property.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, projectId: true, contactId: true },
      });

      if (!existing) {
        throw new Error('not_found');
      }

      // Resolve project if name provided
      let projectId = existing.projectId;
      if (projectName !== undefined) {
        if (projectName) {
          const found = await tx.project.findFirst({
            where: { organizationId: orgId, name: projectName, deletedAt: null },
            select: { id: true },
          });
          projectId = found
            ? found.id
            : (await tx.project.create({ data: { organizationId: orgId, name: projectName } })).id;
        } else {
          projectId = null;
        }
      }

      // Resolve contact
      let contactId = existing.contactId;
      if (contactName !== undefined) {
        if (existing.contactId) {
          await tx.contact.update({
            where: { id: existing.contactId },
            data: {
              name: contactName || undefined,
              contactType: contactType ?? undefined,
              phone: contactPhone !== undefined ? contactPhone || null : undefined,
              lineId: contactLineId !== undefined ? contactLineId || null : undefined,
              email: contactEmail !== undefined ? contactEmail || null : undefined,
            },
          });
        } else if (contactName) {
          const created = await tx.contact.create({
            data: {
              organizationId: orgId,
              name: contactName,
              contactType: contactType ?? 'agent',
              phone: contactPhone || null,
              lineId: contactLineId || null,
              email: contactEmail || null,
            },
          });
          contactId = created.id;
        }
      }

      await tx.property.update({
        where: { id },
        data: {
          ...propertyFields,
          projectId,
          contactId,
          updatedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'property',
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
    console.error('updateProperty failed', error);
    return { ok: false, error: 'server' };
  }
}
