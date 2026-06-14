import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { listOrgUsers } from '@/features/flips/queries/list-org-users';
import { TaskListPanel } from '@/features/tasks/components/task-list-panel';
import { listTasksForFlip } from '@/features/tasks/queries/list-tasks-for-flip';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipTasksPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [flip, tasks, candidates] = await Promise.all([
    getFlipById(orgId, flipId),
    listTasksForFlip(orgId, flipId),
    listOrgUsers(orgId),
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
        <h1 className="text-xl font-semibold text-text-strong">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('subtitle')}</p>
      </div>

      <TaskListPanel flipId={flip.id} tasks={tasks} candidates={candidates} />
    </div>
  );
}
