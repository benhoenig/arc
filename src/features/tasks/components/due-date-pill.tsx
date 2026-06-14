'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pill } from '@/components/data-display/pill';
import { formatDateShort } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';

export type DueDateBucket = 'overdue' | 'today' | 'tomorrow' | 'future' | 'done' | 'none';

// Pure variant logic, exported for unit testing (M7 test criteria). Compares at
// day granularity in the viewer's local timezone. A completed task is never
// "overdue" regardless of its due date.
export function dueDateBucket(
  dueDate: Date | string | null,
  isDone: boolean,
  now: Date = new Date(),
): DueDateBucket {
  if (dueDate == null) {
    return 'none';
  }
  if (isDone) {
    return 'done';
  }

  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  // @db.Date values arrive as UTC midnight — read the calendar date from UTC
  // parts, then compare against the local "today" at local midnight.
  const dueMidnight = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return 'overdue';
  }
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'tomorrow';
  }
  return 'future';
}

const BUCKET_VARIANT = {
  overdue: 'destructive',
  today: 'warning',
  tomorrow: 'warning',
  future: 'neutral',
  done: 'muted',
  none: 'muted',
} as const;

type Props = {
  dueDate: Date | string | null;
  isDone?: boolean;
};

export function DueDatePill({ dueDate, isDone = false }: Props) {
  const t = useTranslations('tasks');
  const locale = useLocale() as Locale;

  const bucket = dueDateBucket(dueDate, isDone);
  if (bucket === 'none') {
    return null;
  }

  const dateLabel = dueDate != null ? formatDateShort(dueDate, locale) : '';
  const label =
    bucket === 'overdue'
      ? `${t('due.overdue')} · ${dateLabel}`
      : bucket === 'today'
        ? t('due.today')
        : bucket === 'tomorrow'
          ? t('due.tomorrow')
          : dateLabel;

  return (
    <Pill variant={BUCKET_VARIANT[bucket]} className={bucket === 'overdue' ? 'font-semibold' : ''}>
      {label}
    </Pill>
  );
}
