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

  const maxAmount = Math.max(...rows.map((r) => Math.max(r.totalBudgetedThb, r.totalActualThb)), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const budgetedWidth = (row.totalBudgetedThb / maxAmount) * 100;
        const actualWidth = (row.totalActualThb / maxAmount) * 100;
        const variancePct =
          row.totalBudgetedThb > 0 ? (row.varianceThb / row.totalBudgetedThb) * 100 : 0;

        const fillClass =
          variancePct > 10 ? 'bg-destructive' : variancePct > 0 ? 'bg-warning' : 'bg-positive';

        const label = locale === 'en' && row.nameEn ? row.nameEn : row.nameTh;

        return (
          <li key={row.categoryId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-default">{label}</span>
              <span className="tabular text-text-muted">
                <Currency amount={row.totalActualThb} /> /{' '}
                <Currency amount={row.totalBudgetedThb} />
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-fill-hover">
              <div
                className="absolute inset-y-0 left-0 bg-border"
                style={{ width: `${budgetedWidth}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 ${fillClass}`}
                style={{ width: `${actualWidth}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
