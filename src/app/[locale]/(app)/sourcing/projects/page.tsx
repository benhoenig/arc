import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProjectsPageClient } from '@/features/sourcing/components/projects-page-client';
import { listProjects } from '@/features/sourcing/queries/list-projects';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const projects = await listProjects(orgId);
  const t = await getTranslations('sourcing.projects');

  return <ProjectsPageClient projects={projects} title={t('title')} addLabel={t('add')} />;
}
