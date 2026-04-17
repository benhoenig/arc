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
      // Resolve project (find or create by name)
      let projectId: string | null = null;
      if (parsed.data.projectName) {
        const existing = await tx.project.findFirst({
          where: { organizationId: orgId, name: parsed.data.projectName, deletedAt: null },
          select: { id: true },
        });
        if (existing) {
          projectId = existing.id;
        } else {
          const created = await tx.project.create({
            data: { organizationId: orgId, name: parsed.data.projectName },
          });
          projectId = created.id;
        }
      }

      // Create contact if any contact info provided
      let contactId: string | null = null;
      if (parsed.data.contactName) {
        const contact = await tx.contact.create({
          data: {
            organizationId: orgId,
            name: parsed.data.contactName,
            contactType: parsed.data.contactType ?? 'agent',
            phone: parsed.data.contactPhone || null,
            lineId: parsed.data.contactLineId || null,
            email: parsed.data.contactEmail || null,
          },
        });
        contactId = contact.id;
      }

      const created = await tx.property.create({
        data: {
          organizationId: orgId,
          listingName: parsed.data.listingName,
          projectId,
          contactId,
          listingUrl: parsed.data.listingUrl || null,
          propertyType: parsed.data.propertyType,
          bedrooms: parsed.data.bedrooms,
          bathrooms: parsed.data.bathrooms,
          floorAreaSqm: parsed.data.floorAreaSqm,
          floors: parsed.data.floors,
          floorLevel: parsed.data.floorLevel ?? null,
          landAreaSqwa: parsed.data.landAreaSqwa ?? null,
          askingPriceThb: parsed.data.askingPriceThb ?? null,
          priceRemark: parsed.data.priceRemark || null,
          notes: parsed.data.notes || null,
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
