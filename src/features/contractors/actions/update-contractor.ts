'use server';

import type { Prisma } from '@prisma-client/client';
import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';
import {
  type UpdateContractorInput,
  updateContractorSchema,
} from '../validators/contractor-schemas';

export async function updateContractor(input: UpdateContractorInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = updateContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { id, ...rest } = parsed.data;

  const keys = Object.keys(rest) as (keyof typeof rest)[];
  if (keys.length === 0) {
    return { ok: false, error: 'validation', issues: [] };
  }

  try {
    await db.$transaction(async (tx) => {
      const contractor = await tx.contractor.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!contractor) {
        throw new Error('not_found');
      }

      const data: Prisma.ContractorUncheckedUpdateInput = { updatedBy: user.id };
      for (const k of keys) {
        if (rest[k] !== undefined) {
          // biome-ignore lint/suspicious/noExplicitAny: optional passthrough of validated union
          (data as any)[k] = rest[k];
        }
      }

      await tx.contractor.update({ where: { id: contractor.id }, data });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor',
        entityId: contractor.id,
        action: 'updated',
        changes: rest as Prisma.InputJsonValue,
      });
    });

    revalidatePath('/contractors');
    revalidatePath(`/contractors/${id}`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('updateContractor failed', error);
    return { ok: false, error: 'server' };
  }
}
