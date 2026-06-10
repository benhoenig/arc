import { useLocale, useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import type { FlipPnl } from '@/features/flips/queries/get-flip-pnl';
import { formatPercent } from '@/lib/formatters/currency';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  pnl: FlipPnl;
};

const COST_ROW_KEYS = [
  'purchase',
  'renovation',
  'holding',
  'transaction',
  'selling',
  'marketing',
  'other',
] as const;

export function FlipFeasibilityPanel({ pnl }: Props) {
  const t = useTranslations('flips.feasibility');
  const locale = useLocale() as Locale;

  const baselineIncomplete = pnl.revenue.plan === 0 || pnl.costs.purchase.plan == null;
  if (baselineIncomplete) {
    return (
      <div className="rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-strong">{t('title')}</h2>
        </div>
        <p className="mt-3 text-sm text-text-muted">{t('emptyState')}</p>
      </div>
    );
  }

  const planNote = pnl.hasRevision
    ? t('revisionNote', { number: pnl.latestRevisionNumber ?? 0 })
    : t('baselineNote');

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-strong">{t('title')}</h2>
        <span className="text-xs text-text-muted">{planNote}</span>
      </div>
      <p className="mb-4 text-xs text-text-muted">{t('subtitle')}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="py-2 text-left font-medium"> </th>
              <th className="px-2 py-2 text-right font-medium">{t('planColumn')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('actualColumn')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('varianceColumn')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border-subtle">
              <td className="py-1.5 pr-2 text-text-default">
                {pnl.sold ? t('revenueSold') : t('revenue')}
              </td>
              <td className="px-2 py-1.5 text-right text-text-default">
                <Currency amount={pnl.revenue.plan} />
              </td>
              <td className="px-2 py-1.5 text-right">
                {pnl.revenue.actual != null ? (
                  <Currency amount={pnl.revenue.actual} />
                ) : (
                  <span className="text-text-muted">{t('notTrackedYet')}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                <VarianceCell plan={pnl.revenue.plan} actual={pnl.revenue.actual} higherIsBetter />
              </td>
            </tr>

            <tr className="bg-surface">
              <td
                className="py-1.5 pr-2 text-xs font-semibold uppercase tracking-wide text-text-muted"
                colSpan={4}
              >
                {t('costs')}
              </td>
            </tr>

            {COST_ROW_KEYS.map((key) => {
              const row = pnl.costs[key];
              return (
                <tr key={key} className="border-t border-border-subtle">
                  <td className="py-1.5 pr-2 text-text-default">{t(key)}</td>
                  <td className="px-2 py-1.5 text-right text-text-default">
                    {row.plan != null ? (
                      <Currency amount={row.plan} />
                    ) : (
                      <span className="text-text-muted">{t('notTrackedYet')}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {row.actual != null ? (
                      <Currency amount={row.actual} />
                    ) : (
                      <span
                        className="text-text-muted"
                        title={
                          key === 'purchase' || key === 'renovation' ? '' : t('notTrackedHint')
                        }
                      >
                        {t('notTrackedYet')}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {row.plan != null && row.actual != null ? (
                      <VarianceCell plan={row.plan} actual={row.actual} higherIsBetter={false} />
                    ) : (
                      <span className="text-text-muted">{t('notTrackedYet')}</span>
                    )}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t-2 border-border bg-surface">
              <td className="py-2 pr-2 text-sm font-semibold text-text-strong">{t('totalCost')}</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-text-strong">
                <Currency amount={pnl.totalPlanCost} />
              </td>
              <td className="px-2 py-2 text-right text-sm font-medium text-text-default">
                <Currency amount={pnl.projectedTotalCost} />
              </td>
              <td className="px-2 py-2 text-right">
                <VarianceCell
                  plan={pnl.totalPlanCost}
                  actual={pnl.projectedTotalCost}
                  higherIsBetter={false}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ProfitCell
          label={t('profit')}
          planned={pnl.plannedProfitThb}
          projected={pnl.projectedProfitThb}
          realized={pnl.realizedProfitThb}
          plannedLabel={t('plannedLabel')}
          projectedLabel={t('projectedLabel')}
          realizedLabel={t('realizedLabel')}
          format={(v) => <Currency amount={v} />}
          isProfit
        />
        <ProfitCell
          label={t('margin')}
          planned={pnl.plannedMarginPct}
          projected={pnl.projectedMarginPct}
          realized={pnl.realizedMarginPct}
          plannedLabel={t('plannedLabel')}
          projectedLabel={t('projectedLabel')}
          realizedLabel={t('realizedLabel')}
          format={(v) => <>{formatPercent(v, locale)}</>}
        />
        <ProfitCell
          label={t('roi')}
          planned={pnl.plannedRoiPct}
          projected={pnl.projectedRoiPct}
          realized={pnl.realizedRoiPct}
          plannedLabel={t('plannedLabel')}
          projectedLabel={t('projectedLabel')}
          realizedLabel={t('realizedLabel')}
          format={(v) => <>{formatPercent(v, locale)}</>}
        />
      </div>
    </div>
  );
}

function VarianceCell({
  plan,
  actual,
  higherIsBetter,
}: {
  plan: number;
  actual: number | null;
  higherIsBetter: boolean;
}) {
  const locale = useLocale() as Locale;
  if (actual == null || plan === 0) {
    return <span className="text-text-muted">—</span>;
  }
  const delta = actual - plan;
  const pct = (delta / plan) * 100;

  // Directionality: for revenue (higher is better), positive delta = good.
  // For cost (lower is better), positive delta = bad (overrun).
  const badPct = higherIsBetter ? -pct : pct;
  const colorClass =
    badPct < -1
      ? 'text-positive'
      : badPct <= 1
        ? 'text-text-muted'
        : badPct <= 10
          ? 'text-warning'
          : 'text-destructive';

  const sign = delta > 0 ? '+' : '';
  return (
    <span className={cn('tabular whitespace-nowrap font-medium', colorClass)}>
      {sign}
      {new Intl.NumberFormat(locale).format(Math.round(delta))} ({sign}
      {formatPercent(pct, locale)})
    </span>
  );
}

function ProfitCell<T extends number | null>({
  label,
  planned,
  projected,
  realized,
  plannedLabel,
  projectedLabel,
  realizedLabel,
  format,
  isProfit,
}: {
  label: string;
  planned: T;
  projected: T;
  realized: T;
  plannedLabel: string;
  projectedLabel: string;
  realizedLabel: string;
  format: (v: number) => React.ReactNode;
  isProfit?: boolean;
}) {
  // Directionality: profit/margin/ROI — negative is bad, positive neutral.
  // Only color the "projected" row (the live number operators act on) to
  // avoid a sea of green/red. Planned stays neutral (it's history); realized
  // colors green when sold at a profit.
  const projectedColor =
    isProfit && projected != null && projected < 0
      ? 'text-destructive'
      : isProfit && projected != null && projected > 0
        ? 'text-text-strong'
        : 'text-text-default';

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-sm">
        <Row label={plannedLabel} value={planned} format={format} />
        <Row
          label={projectedLabel}
          value={projected}
          format={format}
          className={cn('font-semibold', projectedColor)}
        />
        {realized != null ? (
          <Row
            label={realizedLabel}
            value={realized}
            format={format}
            className="font-semibold text-positive"
          />
        ) : null}
      </div>
    </div>
  );
}

function Row<T extends number | null>({
  label,
  value,
  format,
  className,
}: {
  label: string;
  value: T;
  format: (v: number) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={cn('tabular whitespace-nowrap', className)}>
        {value == null ? <span className="text-text-muted">—</span> : format(value)}
      </span>
    </div>
  );
}
