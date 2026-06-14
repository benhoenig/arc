'use client';

import { ArrowRight, CalendarClock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import { formatDateShort } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';

type Props = {
  flipId: string;
  openCount: number;
  overdueCount: number;
  nextMilestone: { title: string; targetDate: Date | string } | null;
};

// Read-only summary on the flip detail page. Full task list + timeline live on
// the /tasks and /timeline sub-routes (same inline-summary + sub-route-editing
// pattern as budget/contractors).
export function FlipTasksPanel({ flipId, openCount, overdueCount, nextMilestone }: Props) {
  const t = useTranslations('tasks');
  const locale = useLocale() as Locale;

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('panel.title')}</h2>
        <Link
          href={`/flips/${flipId}/tasks`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-default"
        >
          {t('panel.viewAll')}
          <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <Pill variant="neutral">{t('panel.openTasks', { count: openCount })}</Pill>
          {overdueCount > 0 ? (
            <Pill variant="destructive">{t('panel.overdue', { count: overdueCount })}</Pill>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-text-muted">
          <CalendarClock size={14} strokeWidth={1.5} />
          {nextMilestone ? (
            <span>
              {t('panel.upcomingMilestone')}: {nextMilestone.title} ·{' '}
              {formatDateShort(nextMilestone.targetDate, locale)}
            </span>
          ) : (
            <span>{t('panel.noMilestones')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
