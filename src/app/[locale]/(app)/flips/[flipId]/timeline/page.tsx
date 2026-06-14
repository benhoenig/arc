import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { TimelinePanel } from '@/features/tasks/components/timeline-panel';
import { listMilestonesForFlip } from '@/features/tasks/queries/list-milestones-for-flip';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipTimelinePage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [flip, milestones] = await Promise.all([
    getFlipById(orgId, flipId),
    listMilestonesForFlip(orgId, flipId),
  ]);

  if (!flip) {
    notFound();
  }

  const t = await getTranslations('tasks');

  return (
    <div className="px-6 py-6">
      <Link
        href={`/flips/${flip.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {flip.code} · {flip.name}
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text-strong">{t('timeline.title')}</h1>
        <p className="text-sm text-text-muted">{t('timeline.subtitle')}</p>
      </div>

      <TimelinePanel flipId={flip.id} milestones={milestones} />
    </div>
  );
}
