import 'server-only';

import { db } from '@/server/db';

/**
 * Lists pending (non-accepted, non-revoked, non-deleted) invitations for
 * an org. Expired invites are kept in the list so admins can see what
 * needs revoking/re-sending; the UI shows their status.
 */
export async function listInvitations(orgId: string) {
  return db.orgInvitation.findMany({
    where: {
      organizationId: orgId,
      acceptedAt: null,
      revokedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      createdAt: true,
      role: { select: { slug: true, nameTh: true, nameEn: true } },
      invitedByUser: { select: { fullName: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export type InvitationListItem = Awaited<ReturnType<typeof listInvitations>>[number];
