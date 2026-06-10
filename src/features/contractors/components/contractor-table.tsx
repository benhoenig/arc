'use client';

import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import type { ContractorListItem } from '../queries/list-contractors';

type Props = {
  contractors: ContractorListItem[];
};

export function ContractorTable({ contractors }: Props) {
  const t = useTranslations('contractors');

  if (contractors.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyDescription')} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-2 font-medium">{t('columns.name')}</th>
            <th className="px-2 py-2 font-medium">{t('columns.type')}</th>
            <th className="px-2 py-2 font-medium">{t('columns.trade')}</th>
            <th className="px-2 py-2 font-medium">{t('columns.phone')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('columns.rate')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('columns.activeAssignments')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('columns.totalPaid')}</th>
          </tr>
        </thead>
        <tbody>
          {contractors.map((c) => (
            <tr key={c.id} className="border-t border-border-subtle">
              <td className="px-4 py-2">
                <Link
                  href={`/contractors/${c.id}`}
                  className="font-medium text-text-strong hover:underline"
                >
                  {c.name}
                </Link>
              </td>
              <td className="px-2 py-2">
                <Pill variant="muted">
                  {t(`types.${c.contractorType as 'individual' | 'company'}`)}
                </Pill>
              </td>
              <td className="px-2 py-2 text-text-muted">
                {c.primaryTrade ? t(`trades.${c.primaryTrade as 'general'}`) : '—'}
              </td>
              <td className="px-2 py-2 text-text-muted">{c.phone ?? '—'}</td>
              <td className="px-2 py-2 text-right tabular text-text-muted">
                {c.defaultDailyRateThb != null ? (
                  <Currency amount={c.defaultDailyRateThb} />
                ) : c.defaultHourlyRateThb != null ? (
                  <Currency amount={c.defaultHourlyRateThb} />
                ) : (
                  '—'
                )}
              </td>
              <td className="px-2 py-2 text-right tabular">
                {c.activeAssignmentsCount > 0 ? (
                  <span className="text-text-strong">{c.activeAssignmentsCount}</span>
                ) : (
                  <span className="text-text-muted">0</span>
                )}
              </td>
              <td className="px-2 py-2 text-right tabular text-text-muted">
                <Currency amount={c.totalPaidThb} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
