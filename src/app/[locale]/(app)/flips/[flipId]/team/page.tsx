import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FlipTeamPanel } from '@/features/flips/components/flip-team-panel';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { listOrgUsers } from '@/features/flips/queries/list-org-users';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipTeamPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [flip, candidates] = await Promise.all([getFlipById(orgId, flipId), listOrgUsers(orgId)]);

  if (!flip) {
    notFound();
  }

  const t = await getTranslations('flips');
  const locked =
    flip.stage.slug === 'sold' ||
    flip.stage.slug === 'killed' ||
    flip.soldAt != null ||
    flip.killedAt != null;

  return (
    <div className="px-6 py-6">
      <Link
        href={`/flips/${flip.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {flip.code} · {flip.name}
      </Link>

      <h1 className="mb-4 text-xl font-semibold text-text-strong">{t('team.title')}</h1>

      <FlipTeamPanel
        flipId={flip.id}
        members={flip.teamMembers.map((m) => ({
          id: m.id,
          roleInFlip: m.roleInFlip,
          assignedAt: m.assignedAt,
          user: m.user,
        }))}
        candidates={candidates}
        readOnly={locked}
      />
    </div>
  );
}
