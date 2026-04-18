import 'server-only';

import { db } from '@/server/db';
import { hashInviteToken } from '../lib/invite-token';

/**
 * Public-facing lookup used by the invite accept page. Runs as the calling
 * user (anon before signup, authenticated after) — the SECURITY DEFINER
 * function `get_invitation_by_hash` is the only path that bypasses RLS,
 * and it only returns rows for invitations that are still valid.
 */
export async function getInvitationByToken(rawToken: string) {
  const hash = hashInviteToken(rawToken);

  const rows = await db.$queryRaw<
    Array<{
      invitation_id: string;
      organization_id: string;
      organization_name: string;
      email: string;
      role_slug: string;
      role_name_th: string;
      role_name_en: string | null;
      expires_at: Date;
    }>
  >`SELECT * FROM get_invitation_by_hash(${hash})`;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    invitationId: row.invitation_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    role: {
      slug: row.role_slug,
      nameTh: row.role_name_th,
      nameEn: row.role_name_en,
    },
    expiresAt: row.expires_at,
  };
}

export type InvitationDetail = NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>;
