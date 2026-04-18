import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import type { FlipRevisionItem } from '../queries/list-flip-revisions';

type Props = {
  revisions: FlipRevisionItem[];
};

export function FlipRevisionsPanel({ revisions }: Props) {
  const t = useTranslations('flips.revisions');
  const tType = useTranslations('flips.revisions.types');
  const tRev = useTranslations('flips.revisionShared');

  if (revisions.length === 0) {
    return (
      <div className="rounded-md border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('title')}</h2>
        <EmptyState title={t('empty')} className="py-6" />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-strong">{t('title')}</h2>
      <ul className="flex flex-col gap-4">
        {revisions.map((r) => {
          const author =
            r.createdByUser?.displayName ??
            r.createdByUser?.fullName ??
            r.createdByUser?.email ??
            '—';
          return (
            <li key={r.id} className="rounded-md border border-border-subtle p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-text-strong">
                  {t('revisionN', { n: r.revisionNumber })}
                </span>
                <Pill>{tType(r.revisionType as 'pivot_to_transfer_in' | 'reunderwrite')}</Pill>
                <span className="text-text-muted">
                  {t('by')} {author} · {t('at')} <DateDisplay date={r.createdAt} format="short" />
                </span>
              </div>

              {r.reasonNotes ? (
                <p className="mb-3 whitespace-pre-wrap text-sm text-text-default">
                  {r.reasonNotes}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <Row label={tRev('sunkTotal')}>
                  <Currency
                    amount={
                      r.sunkDepositThb +
                      r.sunkRenoSpentThb +
                      r.sunkMarketingSpentThb +
                      r.sunkOtherThb
                    }
                  />
                </Row>
                <Row label={tRev('newTotal')}>
                  <Currency
                    amount={
                      r.newRemainingPropertyCostThb +
                      r.newTransferFeesCashThb +
                      r.newTransferFeesLoanThb +
                      r.newLoanOriginationThb +
                      r.newRenoBudgetThb +
                      r.newMarketingBudgetThb +
                      r.newCommissionThb +
                      r.newAdditionalDepositThb +
                      r.newAdditionalExpenseThb
                    }
                  />
                </Row>
                <Row label={tRev('totalCapital')}>
                  <Currency amount={r.totalCapitalDeployedThb} />
                </Row>
                <Row label={tRev('projectedProfit')}>
                  <span
                    className={r.projectedProfitThb >= 0 ? 'text-positive' : 'text-destructive'}
                  >
                    <Currency amount={r.projectedProfitThb} />
                  </span>
                </Row>
                <Row label={tRev('projectedMargin')}>
                  <span className="tabular">{r.projectedMarginPct.toFixed(1)}%</span>
                </Row>
                <Row label={tRev('projectedRoi')}>
                  <span className="tabular">{r.projectedRoiPct.toFixed(1)}%</span>
                </Row>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-strong">{children}</span>
    </div>
  );
}
