'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { removeTeamMemberSchema } from '../validators/flip-schemas';

export async function removeTeamMember(
  input: z.infer<typeof removeTeamMemberSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const parsed = removeTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const member = await tx.flipTeamMember.findFirst({
        where: {
          id: parsed.data.memberId,
          flipId: parsed.data.flipId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true, userId: true, roleInFlip: true },
      });
      if (!member) {
        throw new Error('not_found');
      }

      await tx.flipTeamMember.update({
        where: { id: member.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip',
        entityId: parsed.data.flipId,
        action: 'team_removed',
        changes: { userId: member.userId, roleInFlip: member.roleInFlip },
      });
    });

    revalidatePath(`/flips/${parsed.data.flipId}`);
    revalidatePath(`/flips/${parsed.data.flipId}/team`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    console.error('removeTeamMember failed', error);
    return { ok: false, error: 'server' };
  }
}
