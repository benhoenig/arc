'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { createProjectSchema } from '../validators/sourcing-schemas';

export async function createProject(
  input: Record<string, unknown>,
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const project = await db.$transaction(async (tx) => {
      // Check for duplicate name within org
      const existing = await tx.project.findFirst({
        where: { organizationId: orgId, name: parsed.data.name, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        throw new Error('conflict');
      }

      const created = await tx.project.create({
        data: {
          organizationId: orgId,
          name: parsed.data.name,
          developer: parsed.data.developer || null,
          location: parsed.data.location || null,
          propertyType: parsed.data.propertyType || null,
          notes: parsed.data.notes || null,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'project',
        entityId: created.id,
        action: 'created',
      });

      return created;
    });

    revalidatePath('/sourcing');
    return { ok: true, data: { projectId: project.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'conflict') {
      return { ok: false, error: 'conflict', message: 'Project name already exists' };
    }
    console.error('createProject failed', error);
    return { ok: false, error: 'server' };
  }
}
