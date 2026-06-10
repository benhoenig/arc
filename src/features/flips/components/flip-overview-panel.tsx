import { useTranslations } from 'next-intl';
import { DateDisplay } from '@/components/data-display/date-display';
import { Pill } from '@/components/data-display/pill';

type Props = {
  actuals: {
    acquiredAt: Date | null;
    listedAt: Date | null;
    soldAt: Date | null;
  };
  targetTimelineDays: number | null;
  hasInvestorCapital: boolean;
  notes: string | null;
};

// Lifecycle metadata strip. Financial numbers live in FlipFeasibilityPanel —
// this panel answers "where is this deal in its lifecycle?" not "is it
// profitable?". Replaces the earlier baseline/actuals cards which duplicated
// numbers the P&L panel presents better.
export function FlipOverviewPanel({
  actuals,
  targetTimelineDays,
  hasInvestorCapital,
  notes,
}: Props) {
  const t = useTranslations('flips.detail');

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-md border border-border p-4">
        <dl className="flex flex-wrap items-start gap-x-8 gap-y-3 text-sm">
          <Stat label={t('acquiredAt')}>
            {actuals.acquiredAt ? <DateDisplay date={actuals.acquiredAt} format="short" /> : '—'}
          </Stat>
          <Stat label={t('listedAt')}>
            {actuals.listedAt ? <DateDisplay date={actuals.listedAt} format="short" /> : '—'}
          </Stat>
          <Stat label={t('soldAt')}>
            {actuals.soldAt ? <DateDisplay date={actuals.soldAt} format="short" /> : '—'}
          </Stat>
          <Stat label={t('baselineTimeline')}>
            {targetTimelineDays != null ? `${targetTimelineDays}` : '—'}
          </Stat>
          {hasInvestorCapital ? (
            <div className="ml-auto">
              <Pill variant="neutral">{t('hasInvestorCapital')}</Pill>
            </div>
          ) : null}
        </dl>
      </section>

      {notes ? (
        <section className="rounded-md border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold text-text-strong">{t('notes')}</h3>
          <p className="whitespace-pre-wrap text-sm text-text-default">{notes}</p>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-default">{children}</dd>
    </div>
  );
}
