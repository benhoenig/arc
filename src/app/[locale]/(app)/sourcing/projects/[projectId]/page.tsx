import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { Pill } from '@/components/data-display/pill';
import { ProjectEditForm } from '@/features/sourcing/components/project-edit-form';
import { getProject } from '@/features/sourcing/queries/get-project';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; projectId: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const project = await getProject(orgId, projectId);

  if (!project) {
    notFound();
  }

  const t = await getTranslations('sourcing');
  const tPropTypes = await getTranslations('sourcing.propertyTypes');

  return (
    <div className="px-6 py-6">
      <Link
        href="/sourcing/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('projects.detail.backToList')}
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-strong">{project.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted">
              {project.developer && <span>{project.developer}</span>}
              {project.location && <span>{project.location}</span>}
              {project.propertyType && <Pill>{tPropTypes(project.propertyType)}</Pill>}
            </div>
          </div>
          <ProjectEditForm project={project} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-strong">
          {t('projects.detail.linkedProperties', { count: project.properties.length })}
        </h2>

        {project.properties.length === 0 ? (
          <p className="text-sm text-text-muted">{t('projects.detail.noProperties')}</p>
        ) : (
          <div className="space-y-2">
            {project.properties.map((prop) => (
              <Link
                key={prop.id}
                href={`/sourcing/properties/${prop.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-fill-hover"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-strong">{prop.listingName}</span>
                  <Pill>{tPropTypes(prop.propertyType)}</Pill>
                </div>
                {prop.askingPriceThb && (
                  <Currency amount={prop.askingPriceThb} className="text-sm" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
