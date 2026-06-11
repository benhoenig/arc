'use client';

import { History } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Currency } from '@/components/data-display/currency';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  FlipActivityChange,
  FlipActivityEntry,
} from '@/features/flips/queries/list-flip-activity';
import { formatDate } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';

type Props = {
  entries: FlipActivityEntry[];
};

const ENTITY_LABEL_KEYS: Record<string, string> = {
  flip: 'history.entity.flip',
  deal_analysis: 'history.entity.dealAnalysis',
  budget_line: 'history.entity.budgetLine',
  flip_transaction: 'history.entity.transaction',
};

// Actions we have translated labels for; anything else falls back to the raw
// action string so a new action type never crashes the panel.
const KNOWN_ACTIONS = new Set([
  'created',
  'updated',
  'deleted',
  'revised',
  'pivoted',
  'overheads_updated',
]);

const OVERHEAD_KEYS = new Set(['holding', 'transaction', 'selling', 'marketing', 'other']);

// Change-field key → translation key. Overhead keys reuse the feasibility row
// labels; the rest live under flips.history.field.*.
const FIELD_LABEL_KEYS: Record<string, string> = {
  category: 'history.field.category',
  budgetLine: 'history.field.budgetLine',
  description: 'history.field.description',
  budgetedAmountThb: 'history.field.budgeted',
  committedAmountThb: 'history.field.committed',
  amountThb: 'history.field.amount',
  sourceNote: 'history.field.source',
  kind: 'history.field.kind',
  revisionNumber: 'history.field.revisionNumber',
  revisionType: 'history.field.revisionType',
  mode: 'history.field.mode',
  projectedProfitThb: 'history.field.projectedProfit',
  totalCapitalDeployedThb: 'history.field.capitalDeployed',
  holding: 'feasibility.holding',
  transaction: 'feasibility.transaction',
  selling: 'feasibility.selling',
  marketing: 'feasibility.marketing',
  other: 'feasibility.other',
};

const TXN_KINDS = new Set([
  'investor_deposit',
  'loan_disbursement',
  'spend',
  'refund',
  'sale_proceeds',
  'distribution',
]);

function isFromTo(value: FlipActivityChange['value']): value is { from: number; to: number } {
  return typeof value === 'object' && value !== null && 'from' in value;
}

// Amount fields render as currency; everything else as a plain number/string.
function isAmountKey(key: string): boolean {
  return key.endsWith('Thb') || OVERHEAD_KEYS.has(key);
}

export function FlipHistoryPanel({ entries }: Props) {
  const t = useTranslations('flips');
  const tBudget = useTranslations('budget');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const numberFormat = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US');
  const timeFormat = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  function fieldLabel(key: string): string {
    const labelKey = FIELD_LABEL_KEYS[key];
    return labelKey ? t(labelKey) : key;
  }

  function renderValue({ key, value }: FlipActivityChange) {
    const amount = isAmountKey(key);
    if (isFromTo(value)) {
      return amount ? (
        <span className="tabular whitespace-nowrap">
          <Currency amount={value.from} /> → <Currency amount={value.to} />
        </span>
      ) : (
        <span className="tabular">
          {numberFormat.format(value.from)} → {numberFormat.format(value.to)}
        </span>
      );
    }
    if (typeof value === 'number') {
      return amount ? (
        <Currency amount={value} />
      ) : (
        <span className="tabular">{numberFormat.format(value)}</span>
      );
    }
    if (key === 'kind' && TXN_KINDS.has(value)) {
      return <span>{tBudget(`transactions.kinds.${value}`)}</span>;
    }
    return <span>{value}</span>;
  }

  function renderChanges(changes: FlipActivityChange[]) {
    if (changes.length === 0) {
      return null;
    }
    return (
      <ul className="mt-1 space-y-0.5">
        {changes.map((change) => (
          <li key={change.key} className="text-xs text-text-muted">
            <span className="text-text-default">{fieldLabel(change.key)}:</span>{' '}
            {renderValue(change)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-text-strong">{t('history.title')}</h2>
        <p className="text-xs text-text-muted">{t('history.subtitle')}</p>
      </div>

      {entries.length === 0 ? (
        <span className="text-xs text-text-muted">{t('history.empty')}</span>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <History size={14} strokeWidth={1.5} />
              {t('history.view', { count: entries.length })}
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('history.title')}</DialogTitle>
              <DialogDescription>{t('history.subtitle')}</DialogDescription>
            </DialogHeader>

            <ol className="-mr-2 space-y-3 overflow-y-auto pr-2">
              {entries.map((entry) => {
                const entityKey = ENTITY_LABEL_KEYS[entry.entityType];
                const entityLabel = entityKey ? t(entityKey) : entry.entityType;
                const actionLabel = KNOWN_ACTIONS.has(entry.action)
                  ? t(`history.action.${entry.action}`)
                  : entry.action;
                return (
                  <li key={entry.id} className="border-l border-border-subtle pl-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-text-default">
                        <span className="font-medium text-text-strong">
                          {entry.user?.name ?? t('history.system')}
                        </span>{' '}
                        {actionLabel} · {entityLabel}
                      </span>
                      <span className="whitespace-nowrap text-xs text-text-muted">
                        {formatDate(entry.createdAt, locale)} {timeFormat.format(entry.createdAt)}
                      </span>
                    </div>
                    {renderChanges(entry.changes)}
                  </li>
                );
              })}
            </ol>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
