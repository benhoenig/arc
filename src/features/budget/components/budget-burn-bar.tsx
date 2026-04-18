'use client';

import { useTranslations } from 'next-intl';

type Props = {
  totalBudgetedThb: number;
  totalCommittedThb: number;
  totalActualThb: number;
};

/**
 * Horizontal progress bar for budget utilization.
 * - Actual % fills with a semantic color (positive if <100%, warning 100-110%, destructive >110%).
 * - Committed is a secondary track overlaid above actual to show pipeline.
 * - If budget is 0, render as an empty neutral bar.
 */
export function BudgetBurnBar({ totalBudgetedThb, totalCommittedThb, totalActualThb }: Props) {
  const t = useTranslations('budget');

  const actualPct = totalBudgetedThb > 0 ? (totalActualThb / totalBudgetedThb) * 100 : 0;
  const committedPct = totalBudgetedThb > 0 ? (totalCommittedThb / totalBudgetedThb) * 100 : 0;

  const fillClass =
    actualPct > 110
      ? 'bg-destructive'
      : actualPct > 100
        ? 'bg-warning'
        : totalBudgetedThb === 0
          ? 'bg-fill-active'
          : 'bg-positive';

  const clampedActual = Math.min(Math.max(actualPct, 0), 100);
  const clampedCommitted = Math.min(Math.max(committedPct, 0), 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{t('burn.utilization')}</span>
        <span className="tabular text-text-default">
          {totalBudgetedThb === 0 ? '—' : `${actualPct.toFixed(1)}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('burn.utilization')}
        aria-valuenow={Math.round(actualPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-fill-hover"
      >
        {/* Committed track — rendered under the actual fill */}
        <div
          className="absolute inset-y-0 left-0 bg-border"
          style={{ width: `${clampedCommitted}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 ${fillClass}`}
          style={{ width: `${clampedActual}%` }}
        />
      </div>
    </div>
  );
}
