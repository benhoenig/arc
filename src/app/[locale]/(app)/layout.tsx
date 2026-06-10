import { AppShell } from '@/components/layout/app-shell';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';

type Props = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: Props) {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true },
  });

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { fullName: true, displayName: true, email: true },
  });

  return (
    <AppShell
      orgName={org?.name ?? 'ARC'}
      userName={dbUser?.displayName ?? dbUser?.fullName ?? dbUser?.email ?? ''}
      userEmail={dbUser?.email ?? user.email ?? ''}
    >
      {children}
    </AppShell>
  );
}
