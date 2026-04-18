'use client';

import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { Variance } from '@/components/data-display/variance';

type Props = {
  totalBudgetedThb: number;
  totalCommittedThb: number;
  totalActualThb: number;
  varianceThb: number;
  variancePct: number | null;
};

export function BudgetVarianceCard({
  totalBudgetedThb,
  totalCommittedThb,
  totalActualThb,
  varianceThb,
  variancePct,
}: Props) {
  const t = useTranslations('budget');

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('variance.title')}</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
        <Stat label={t('totals.budgeted')} value={<Currency amount={totalBudgetedThb} />} />
        <Stat label={t('totals.committed')} value={<Currency amount={totalCommittedThb} />} />
        <Stat label={t('totals.actual')} value={<Currency amount={totalActualThb} />} />
        <Stat
          label={t('totals.variance')}
          value={
            variancePct == null ? (
              <span className="text-sm text-text-muted">—</span>
            ) : (
              <Variance amount={varianceThb} percent={variancePct} />
            )
          }
        />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-default">{value}</dd>
    </div>
  );
}
