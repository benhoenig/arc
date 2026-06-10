import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { DeleteContractorButton } from '@/features/contractors/components/delete-contractor-button';
import { getContractorById } from '@/features/contractors/queries/get-contractor';
import type {
  AssignmentStatus,
  ContractorTrade,
  ContractorType,
  PaymentModel,
} from '@/features/contractors/validators/contractor-schemas';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; contractorId: string }>;
};

const STATUS_VARIANT: Record<
  AssignmentStatus,
  'muted' | 'active' | 'positive' | 'destructive' | 'warning' | 'neutral'
> = {
  draft: 'muted',
  active: 'active',
  completed: 'positive',
  canceled: 'muted',
  disputed: 'destructive',
};

export default async function ContractorDetailPage({ params }: Props) {
  const { locale, contractorId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [contractor, t] = await Promise.all([
    getContractorById(orgId, contractorId),
    getTranslations('contractors'),
  ]);

  if (!contractor) {
    notFound();
  }

  const hasActiveAssignments = contractor.assignments.some(
    (a) => a.status === 'draft' || a.status === 'active',
  );

  return (
    <div className="px-6 py-6">
      <Link
        href="/contractors"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('backToDirectory')}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-text-strong">{contractor.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <Pill variant="muted">{t(`types.${contractor.contractorType as ContractorType}`)}</Pill>
            {contractor.primaryTrade ? (
              <Pill variant="neutral">
                {t(`trades.${contractor.primaryTrade as ContractorTrade}`)}
              </Pill>
            ) : null}
            {contractor.additionalTrades.map((tr) => (
              <Pill key={tr} variant="muted">
                {t(`trades.${tr as ContractorTrade}`)}
              </Pill>
            ))}
          </div>
        </div>
        <DeleteContractorButton
          id={contractor.id}
          name={contractor.name}
          hasActiveAssignments={hasActiveAssignments}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('detail.profile')}</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Row label={t('form.contactPerson')}>{contractor.contactPerson ?? '—'}</Row>
            <Row label={t('form.phone')}>{contractor.phone ?? '—'}</Row>
            <Row label={t('form.lineId')}>{contractor.lineId ?? '—'}</Row>
            <Row label={t('form.email')}>{contractor.email ?? '—'}</Row>
            <Row label={t('form.taxId')}>{contractor.taxId ?? '—'}</Row>
            <Row label={t('form.defaultDailyRate')}>
              {contractor.defaultDailyRateThb != null ? (
                <Currency amount={contractor.defaultDailyRateThb} />
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('form.defaultHourlyRate')}>
              {contractor.defaultHourlyRateThb != null ? (
                <Currency amount={contractor.defaultHourlyRateThb} />
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('form.address')}>{contractor.address ?? '—'}</Row>
          </dl>
        </section>

        <section className="rounded-md border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('detail.performance')}</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Row label={t('detail.totalAssignments')}>
              <span className="tabular">{contractor.totalAssignmentsCount}</span>
            </Row>
            <Row label={t('detail.totalPaid')}>
              <Currency amount={contractor.totalPaidThb} />
            </Row>
            <Row label={t('detail.onTimeRate')}>
              {contractor.avgOnTimePct != null ? `${contractor.avgOnTimePct.toFixed(1)}%` : '—'}
            </Row>
            <Row label={t('detail.qualityRating')}>
              {contractor.avgQualityRating != null
                ? `${contractor.avgQualityRating.toFixed(1)} / 5`
                : '—'}
            </Row>
            <Row label={t('detail.lastAssignment')}>
              {contractor.lastAssignmentAt ? (
                <DateDisplay date={contractor.lastAssignmentAt} format="short" />
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </section>
      </div>

      {contractor.notes ? (
        <section className="mt-6 rounded-md border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-strong">{t('form.notes')}</h2>
          <p className="whitespace-pre-wrap text-sm text-text-default">{contractor.notes}</p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('detail.assignments')}</h2>
        {contractor.assignments.length === 0 ? (
          <EmptyState title={t('detail.noAssignments')} className="py-8" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2 font-medium">{t('assignments.columns.contractor')}</th>
                  <th className="px-2 py-2 font-medium">{t('assignments.columns.title')}</th>
                  <th className="px-2 py-2 font-medium">{t('assignments.columns.paymentModel')}</th>
                  <th className="px-2 py-2 text-right font-medium">
                    {t('assignments.columns.amount')}
                  </th>
                  <th className="px-2 py-2 font-medium">{t('assignments.columns.startDate')}</th>
                  <th className="px-2 py-2 font-medium">{t('assignments.columns.endDate')}</th>
                  <th className="px-2 py-2 font-medium">{t('assignments.columns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {contractor.assignments.map((a) => (
                  <tr key={a.id} className="border-t border-border-subtle">
                    <td className="px-4 py-2">
                      <Link
                        href={`/flips/${a.flip.id}`}
                        className="font-medium text-text-strong hover:underline"
                      >
                        {a.flip.code}
                      </Link>
                      <div className="text-xs text-text-muted">{a.flip.name}</div>
                    </td>
                    <td className="px-2 py-2 text-text-default">{a.title}</td>
                    <td className="px-2 py-2 text-text-muted">
                      {t(`paymentModels.${a.paymentModel as PaymentModel}`)}
                    </td>
                    <td className="px-2 py-2 text-right tabular text-text-default">
                      {a.contractAmountThb != null ? (
                        <Currency amount={a.contractAmountThb} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2 text-text-muted">
                      {a.startDate ? <DateDisplay date={a.startDate} format="short" /> : '—'}
                    </td>
                    <td className="px-2 py-2 text-text-muted">
                      {a.targetEndDate ? (
                        <DateDisplay date={a.targetEndDate} format="short" />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Pill variant={STATUS_VARIANT[a.status as AssignmentStatus]}>
                        {t(`statuses.${a.status as AssignmentStatus}`)}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
