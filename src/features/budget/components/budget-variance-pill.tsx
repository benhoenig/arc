'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import { formatPercent } from '@/lib/formatters/currency';
import type { Locale } from '@/lib/i18n';

type Props = {
  variancePct: number | null;
  lineCount: number;
  href?: string;
};

export function BudgetVariancePill({ variancePct, lineCount, href }: Props) {
  const t = useTranslations('budget');
  const locale = useLocale() as Locale;

  const isEmpty = lineCount === 0 || variancePct == null;
  const variant = isEmpty
    ? 'muted'
    : variancePct < -1
      ? 'positive'
      : variancePct <= 1
        ? 'neutral'
        : variancePct <= 10
          ? 'warning'
          : 'destructive';

  const sign = !isEmpty && variancePct > 0 ? '+' : '';
  const label = isEmpty
    ? t('pill.noBudget')
    : `${t('pill.label')} ${sign}${formatPercent(variancePct, locale)}`;

  const pill = <Pill variant={variant}>{label}</Pill>;
  if (!href) {
    return pill;
  }

  return (
    <Link
      href={href}
      className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
    >
      {pill}
    </Link>
  );
}
