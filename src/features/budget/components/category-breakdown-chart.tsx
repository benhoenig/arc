'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { EmptyState } from '@/components/data-display/empty-state';
import type { Locale } from '@/lib/i18n';
import type { CategoryBreakdownRow } from '../queries/get-category-breakdown';

type Props = {
  rows: CategoryBreakdownRow[];
};

export function CategoryBreakdownChart({ rows }: Props) {
  const t = useTranslations('budget');
  const locale = useLocale() as Locale;

  if (rows.length === 0) {
    return <EmptyState title={t('categoryChart.empty')} className="py-6" />;
  }

  const totalBudgeted = rows.reduce((sum, row) => sum + row.totalBudgetedThb, 0);
  const sortedRows = [...rows].sort((a, b) => b.totalBudgetedThb - a.totalBudgetedThb);

  return (
    <ul className="flex flex-col gap-2.5">
      {sortedRows.map((row) => {
        const sharePct = totalBudgeted > 0 ? (row.totalBudgetedThb / totalBudgeted) * 100 : 0;
        const shareWidth = Math.min(Math.max(sharePct, 0), 100);

        const label = locale === 'en' && row.nameEn ? row.nameEn : row.nameTh;

        return (
          <li key={row.categoryId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-default">{label}</span>
              <span className="tabular text-text-muted">
                <Currency amount={row.totalBudgetedThb} />
                {totalBudgeted > 0 ? ` (${sharePct.toFixed(1)}%)` : null}
              </span>
            </div>
            <div
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-fill-hover"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(shareWidth)}
            >
              <div
                className="absolute inset-y-0 left-0 bg-destructive"
                style={{ width: `${shareWidth}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
