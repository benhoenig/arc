import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';

type Props = {
  baseline: {
    purchasePriceThb: number | null;
    renovationBudgetThb: number | null;
    targetArvThb: number | null;
    targetMarginPct: number | null;
    targetTimelineDays: number | null;
  };
  actuals: {
    actualPurchasePriceThb: number | null;
    acquiredAt: Date | null;
    listedAt: Date | null;
    soldAt: Date | null;
    actualSalePriceThb: number | null;
  };
  hasInvestorCapital: boolean;
  notes: string | null;
};

export function FlipOverviewPanel({ baseline, actuals, hasInvestorCapital, notes }: Props) {
  const t = useTranslations('flips.detail');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-md border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-strong">{t('baseline')}</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <Row label={t('baselinePurchase')}>
            {baseline.purchasePriceThb != null ? (
              <Currency amount={baseline.purchasePriceThb} />
            ) : (
              '—'
            )}
          </Row>
          <Row label={t('baselineReno')}>
            {baseline.renovationBudgetThb != null ? (
              <Currency amount={baseline.renovationBudgetThb} />
            ) : (
              '—'
            )}
          </Row>
          <Row label={t('baselineArv')}>
            {baseline.targetArvThb != null ? <Currency amount={baseline.targetArvThb} /> : '—'}
          </Row>
          <Row label={t('baselineMargin')}>
            {baseline.targetMarginPct != null ? `${baseline.targetMarginPct.toFixed(1)}%` : '—'}
          </Row>
          <Row label={t('baselineTimeline')}>
            {baseline.targetTimelineDays != null ? `${baseline.targetTimelineDays}` : '—'}
          </Row>
        </dl>
      </section>

      <section className="rounded-md border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-strong">{t('actuals')}</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <Row label={t('actualPurchase')}>
            {actuals.actualPurchasePriceThb != null ? (
              <Currency amount={actuals.actualPurchasePriceThb} />
            ) : (
              '—'
            )}
          </Row>
          <Row label={t('actualSale')}>
            {actuals.actualSalePriceThb != null ? (
              <Currency amount={actuals.actualSalePriceThb} />
            ) : (
              '—'
            )}
          </Row>
          <Row label={t('acquiredAt')}>
            {actuals.acquiredAt ? <DateDisplay date={actuals.acquiredAt} format="short" /> : '—'}
          </Row>
          <Row label={t('listedAt')}>
            {actuals.listedAt ? <DateDisplay date={actuals.listedAt} format="short" /> : '—'}
          </Row>
          <Row label={t('soldAt')}>
            {actuals.soldAt ? <DateDisplay date={actuals.soldAt} format="short" /> : '—'}
          </Row>
          <Row label={t('hasInvestorCapital')}>{hasInvestorCapital ? '✓' : '—'}</Row>
        </dl>
      </section>

      {notes ? (
        <section className="rounded-md border border-border p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-text-strong">{t('notes')}</h3>
          <p className="whitespace-pre-wrap text-sm text-text-default">{notes}</p>
        </section>
      ) : null}

      <section className="rounded-md border border-border-subtle bg-surface p-4 text-sm text-text-muted lg:col-span-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>{t('placeholders.budget')}</div>
          <div>{t('placeholders.timeline')}</div>
          <div>{t('placeholders.documents')}</div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right tabular">{children}</dd>
    </>
  );
}
