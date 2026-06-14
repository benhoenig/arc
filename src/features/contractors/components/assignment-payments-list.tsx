'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import { cancelPayment } from '../actions/payment-decisions';
import type { AssignmentPaymentItem } from '../queries/list-payments-for-assignment';
import type { PaymentStatus } from '../validators/payment-schemas';
import { PaymentStatusPill } from './payment-status-pill';

type Props = {
  payments: AssignmentPaymentItem[];
  readOnly?: boolean;
};

export function AssignmentPaymentsList({ payments, readOnly = false }: Props) {
  const t = useTranslations('payments');

  return (
    <section className="rounded-lg border border-border-subtle">
      <header className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('payments.title')}</h2>
      </header>
      {payments.length === 0 ? (
        <EmptyState title={t('payments.empty')} className="py-8" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">{t('payments.source')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('fields.amount')}</th>
              <th className="px-2 py-2 font-medium">{t('payments.requested')}</th>
              <th className="px-2 py-2 font-medium">{t('payments.paid')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.status')}</th>
              {!readOnly ? <th className="w-20" /> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border-subtle">
                <td className="px-4 py-2 text-text-default">
                  {p.milestone ? p.milestone.title : t('payments.tmBatch')}
                </td>
                <td className="px-2 py-2 text-right tabular text-text-default">
                  <Currency amount={p.amountThb} />
                </td>
                <td className="px-2 py-2 text-text-muted">
                  <DateDisplay date={p.requestedAt} format="short" />
                </td>
                <td className="px-2 py-2 text-text-muted">
                  {p.paidAt ? <DateDisplay date={p.paidAt} format="short" /> : '—'}
                </td>
                <td className="px-2 py-2">
                  <PaymentStatusPill
                    status={p.status}
                    label={t(`payments.statuses.${p.status as PaymentStatus}`)}
                  />
                </td>
                {!readOnly ? (
                  <td className="px-2 py-2 text-right">
                    <CancelButton payment={p} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CancelButton({ payment }: { payment: AssignmentPaymentItem }) {
  const t = useTranslations('payments');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCancel = payment.status === 'requested' || payment.status === 'approved';
  if (!canCancel) {
    return null;
  }

  function cancel() {
    if (!confirm(t('payments.confirmCancel'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await cancelPayment({ id: payment.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={isPending}
      className="text-xs text-text-muted hover:text-destructive"
      title={error ? t(`errors.${error}`) : t('payments.cancel')}
    >
      {t('payments.cancel')}
    </button>
  );
}
