import { setRequestLocale } from 'next-intl/server';
import { MembersPageClient } from '@/features/members/components/members-page-client';
import { listInvitations } from '@/features/members/queries/list-invitations';
import { listMembers } from '@/features/members/queries/list-members';
import { listOrgRoles } from '@/features/members/queries/list-org-roles';
import { isOrgAdmin } from '@/server/shared/require-admin';
import { getActiveOrgId, requireAuth } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const [members, invitationsRaw, isAdmin, roles] = await Promise.all([
    listMembers(orgId),
    listInvitations(orgId),
    isOrgAdmin(user.id, orgId),
    listOrgRoles(orgId),
  ]);

  // Hide pending invitations from non-admins — there's nothing they can do
  // with them and the list would leak prospective teammate emails.
  const invitations = isAdmin ? invitationsRaw : [];

  return (
    <MembersPageClient
      currentUserId={user.id}
      isAdmin={isAdmin}
      members={members}
      invitations={invitations}
      roles={roles}
    />
  );
}
