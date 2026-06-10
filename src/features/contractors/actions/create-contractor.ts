'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type CreateContractorInput,
  createContractorSchema,
} from '../validators/contractor-schemas';

export async function createContractor(
  input: CreateContractorInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const data = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const contractor = await tx.contractor.create({
        data: {
          organizationId: orgId,
          name: data.name,
          contractorType: data.contractorType,
          primaryTrade: data.primaryTrade ?? null,
          additionalTrades: data.additionalTrades ?? [],
          contactPerson: data.contactPerson ?? null,
          phone: data.phone ?? null,
          lineId: data.lineId ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          taxId: data.taxId ?? null,
          defaultDailyRateThb: data.defaultDailyRateThb ?? null,
          defaultHourlyRateThb: data.defaultHourlyRateThb ?? null,
          notes: data.notes ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor',
        entityId: contractor.id,
        action: 'created',
        changes: { name: data.name, contractorType: data.contractorType },
      });

      return contractor;
    });

    revalidatePath('/contractors');
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    console.error('createContractor failed', error);
    return { ok: false, error: 'server' };
  }
}
