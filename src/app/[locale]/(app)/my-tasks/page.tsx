import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MyTasksList } from '@/features/tasks/components/my-tasks-list';
import { listTasksForUser } from '@/features/tasks/queries/list-tasks-for-user';
import { getActiveOrgId, requireAuth } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MyTasksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const user = await requireAuth();
  const tasks = await listTasksForUser(orgId, user.id);

  const t = await getTranslations('tasks');

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-strong">{t('myTasks.title')}</h1>
        <p className="text-sm text-text-muted">{t('myTasks.subtitle')}</p>
      </div>

      <MyTasksList tasks={tasks} />
    </div>
  );
}
