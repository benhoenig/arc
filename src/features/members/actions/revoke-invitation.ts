'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';
import type { ActionResult } from '@/types/common';
import { revokeInvitationSchema } from '../validators/invitation-schemas';

export async function revokeInvitation(
  input: z.infer<typeof revokeInvitationSchema>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = revokeInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  try {
    await db.$transaction(async (tx) => {
      const invitation = await tx.orgInvitation.findFirst({
        where: {
          id: parsed.data.id,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true, acceptedAt: true, revokedAt: true, email: true },
      });
      if (!invitation) {
        throw new Error('not_found');
      }
      if (invitation.acceptedAt) {
        throw new Error('conflict:already_accepted');
      }
      if (invitation.revokedAt) {
        return;
      }

      await tx.orgInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date(), revokedBy: user.id },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'org_invitation',
        entityId: invitation.id,
        action: 'revoked',
      });
    });

    revalidatePath('/settings/members');
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'not_found') {
        return { ok: false, error: 'not_found' };
      }
      if (error.message.startsWith('conflict:')) {
        return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
      }
    }
    console.error('revokeInvitation failed', error);
    return { ok: false, error: 'server' };
  }
}
