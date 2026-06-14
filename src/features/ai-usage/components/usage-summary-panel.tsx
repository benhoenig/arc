'use client';

import { useTranslations } from 'next-intl';
import type { AiUsageSummary } from '../queries/get-usage-summary';

type Props = {
  summary: AiUsageSummary;
};

// Sub-baht costs need more precision than whole baht; show 4 decimals below ฿1.
function formatThb(amount: number): string {
  const decimals = amount > 0 && amount < 1 ? 4 : 2;
  return `฿${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function UsageSummaryPanel({ summary }: Props) {
  const t = useTranslations('settings.ai');
  const totalTokens = summary.totalInputTokens + summary.totalOutputTokens;

  return (
    <section className="flex flex-col gap-3 border-t border-border-subtle pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-text-strong">{t('usageTitle')}</h2>
        <p className="text-xs text-text-muted">{t('usageNote')}</p>
      </div>

      {summary.eventCount === 0 ? (
        <p className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-text-muted">
          {t('usageEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border-subtle bg-surface px-4 py-3">
            <p className="text-xs text-text-muted">{t('usageThisMonth')}</p>
            <p className="mt-1 text-lg font-semibold text-text-strong">
              {formatThb(summary.monthThb)}
            </p>
            <p className="text-xs text-text-muted">
              {t('usageExtractions', { count: summary.monthEventCount })}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface px-4 py-3">
            <p className="text-xs text-text-muted">{t('usageAllTime')}</p>
            <p className="mt-1 text-lg font-semibold text-text-strong">
              {formatThb(summary.totalThb)}
            </p>
            <p className="text-xs text-text-muted">
              {t('usageExtractions', { count: summary.eventCount })}
            </p>
          </div>
          <div className="col-span-2 text-xs text-text-muted">
            {t('usageTokens', {
              input: summary.totalInputTokens.toLocaleString('en-US'),
              output: summary.totalOutputTokens.toLocaleString('en-US'),
              total: totalTokens.toLocaleString('en-US'),
            })}
          </div>
        </div>
      )}
    </section>
  );
}
