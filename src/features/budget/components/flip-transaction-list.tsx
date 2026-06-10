'use client';

import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { formatDate } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';
import { deleteFlipTransaction } from '../actions/delete-flip-transaction';
import type { FlipTransactionItem } from '../queries/list-flip-transactions';
import { isOutflowKind, type TransactionKind } from '../validators/transaction-schemas';
import { ReceiptThumbnail } from './receipt-thumbnail';

type Props = {
  transactions: FlipTransactionItem[];
  readOnly?: boolean;
};

export function FlipTransactionList({ transactions, readOnly = false }: Props) {
  const t = useTranslations('budget');
  const locale = useLocale() as Locale;

  if (transactions.length === 0) {
    return <EmptyState title={t('transactions.empty')} className="py-8" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t('transactions.date')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('transactions.kind')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('transactions.description')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('transactions.category')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('transactions.amount')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('transactions.receipt')}</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} locale={locale} readOnly={readOnly} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowProps = {
  tx: FlipTransactionItem;
  locale: Locale;
  readOnly: boolean;
  t: ReturnType<typeof useTranslations<'budget'>>;
};

function TransactionRow({ tx, locale, readOnly, t }: RowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const kind = tx.kind as TransactionKind;
  const outflow = isOutflowKind(kind);
  const categoryLabel = tx.budgetLine
    ? locale === 'en' && tx.budgetLine.category.nameEn
      ? tx.budgetLine.category.nameEn
      : tx.budgetLine.category.nameTh
    : t('transactions.noBudgetLine');

  function handleDelete() {
    if (!confirm(t('transactions.confirmDelete'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteFlipTransaction({ id: tx.id });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  return (
    <tr className="border-t border-border-subtle">
      <td className="px-4 py-1.5 text-text-muted">
        {formatDate(tx.date instanceof Date ? tx.date : new Date(tx.date), locale)}
      </td>
      <td className="px-2 py-1.5">
        <Pill variant={outflow ? 'neutral' : 'positive'}>{t(`transactions.kinds.${kind}`)}</Pill>
      </td>
      <td className="px-2 py-1.5 text-text-default">
        <div className="flex flex-col">
          <span>{tx.description}</span>
          {tx.sourceNote ? <span className="text-xs text-text-muted">{tx.sourceNote}</span> : null}
        </div>
      </td>
      <td className="px-2 py-1.5 text-text-muted">
        {tx.budgetLine ? (
          <div className="flex flex-col">
            <span className="text-xs">{categoryLabel}</span>
            <span className="text-xs text-text-muted">{tx.budgetLine.description}</span>
          </div>
        ) : (
          <span className="text-xs">{categoryLabel}</span>
        )}
      </td>
      <td
        className={`px-2 py-1.5 text-right font-medium ${outflow ? 'text-text-default' : 'text-positive'}`}
      >
        <Currency amount={tx.amountThb} />
      </td>
      <td className="px-2 py-1.5">
        <ReceiptThumbnail path={tx.receiptPath} />
      </td>
      <td className="w-10 px-2 py-1.5 text-right">
        {readOnly ? null : (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-50"
            aria-label={t('actions.deleteLine')}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
        {error ? <span className="sr-only">{error}</span> : null}
      </td>
    </tr>
  );
}
