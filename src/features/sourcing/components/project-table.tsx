'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import type { ProjectListItem } from '../queries/list-projects';

type Props = {
  projects: ProjectListItem[];
};

export function ProjectTable({ projects }: Props) {
  const t = useTranslations('sourcing.projects');
  const tTypes = useTranslations('sourcing.propertyTypes');

  if (projects.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyDescription')} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-text-muted">
            <th className="pb-2 pr-4 font-medium">{t('columns.name')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.developer')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.location')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.type')}</th>
            <th className="pb-2 font-medium text-right">{t('columns.properties')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-border-subtle last:border-0">
              <td className="py-3 pr-4">
                <Link
                  href={`/sourcing/projects/${project.id}`}
                  className="font-medium text-text-strong hover:underline"
                >
                  {project.name}
                </Link>
              </td>
              <td className="py-3 pr-4 text-text-muted">{project.developer ?? '—'}</td>
              <td className="py-3 pr-4 text-text-muted">{project.location ?? '—'}</td>
              <td className="py-3 pr-4">
                {project.propertyType ? <Pill>{tTypes(project.propertyType)}</Pill> : '—'}
              </td>
              <td className="py-3 text-right tabular">{project._count.properties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
