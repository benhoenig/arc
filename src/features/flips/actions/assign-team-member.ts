'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { assignTeamMemberSchema } from '../validators/flip-schemas';

export async function assignTeamMember(
  input: z.infer<typeof assignTeamMemberSchema>,
): Promise<ActionResult<{ memberId: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = assignTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    const memberId = await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: parsed.data.flipId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }

      const targetIsOrgMember = await tx.userRole.findFirst({
        where: {
          userId: parsed.data.userId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!targetIsOrgMember) {
        throw new Error('conflict:not_org_member');
      }

      const existing = await tx.flipTeamMember.findFirst({
        where: {
          flipId: flip.id,
          userId: parsed.data.userId,
          roleInFlip: parsed.data.roleInFlip,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        throw new Error('conflict:duplicate');
      }

      const member = await tx.flipTeamMember.create({
        data: {
          organizationId: orgId,
          flipId: flip.id,
          userId: parsed.data.userId,
          roleInFlip: parsed.data.roleInFlip,
          assignedBy: user.id,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: flip.id,
        action: 'team_assigned',
        changes: { userId: parsed.data.userId, roleInFlip: parsed.data.roleInFlip },
      });

      return member.id;
    });

    revalidatePath(`/flips/${parsed.data.flipId}`);
    revalidatePath(`/flips/${parsed.data.flipId}/team`);
    return { ok: true, data: { memberId } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('assignTeamMember failed', error);
    return { ok: false, error: 'server' };
  }
}
