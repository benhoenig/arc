'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { deleteBudgetLine } from '../actions/delete-budget-line';
import { updateBudgetLine } from '../actions/update-budget-line';
import type { BudgetLineItem } from '../queries/list-budget-lines';
import { AddTransactionDialog } from './add-transaction-dialog';
import { cleanNumericInput, formatWithCommas, parseAmount } from './amount-input-helpers';

type AmountField = 'budgetedAmountThb' | 'committedAmountThb';

type Props = {
  line: BudgetLineItem;
  flipId: string;
  orgId: string;
  allLines: BudgetLineItem[];
  readOnly?: boolean;
};

export function BudgetLineRow({ line, flipId, orgId, allLines, readOnly = false }: Props) {
  const t = useTranslations('budget');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(line.description);
  const actualIsOverLimit =
    (line.budgetedAmountThb > 0 && line.actualAmountThb > line.budgetedAmountThb) ||
    (line.committedAmountThb > 0 && line.actualAmountThb > line.committedAmountThb);

  function commitAmount(field: AmountField, next: number, original: number) {
    if (Number.isNaN(next) || next < 0) {
      return;
    }
    if (next === original) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateBudgetLine({ id: line.id, [field]: next });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  function commitDescription() {
    if (description.trim().length === 0) {
      setDescription(line.description);
      return;
    }
    if (description === line.description) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateBudgetLine({ id: line.id, description });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        setDescription(line.description);
      }
    });
  }

  function handleDelete() {
    if (!confirm(t('lineRow.confirmDelete'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteBudgetLine({ id: line.id });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  return (
    <tr className="border-t border-border-subtle text-sm">
      <td className="py-1.5 pr-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setDescription(line.description);
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={readOnly || isPending}
          className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-text-default outline-none hover:border-border-subtle focus:border-border focus:bg-surface disabled:cursor-not-allowed"
          aria-label={t('lineRow.description')}
        />
      </td>
      <AmountCell
        initial={line.budgetedAmountThb}
        onCommit={(v) => commitAmount('budgetedAmountThb', v, line.budgetedAmountThb)}
        disabled={readOnly || isPending}
      />
      <AmountCell
        initial={line.committedAmountThb}
        onCommit={(v) => commitAmount('committedAmountThb', v, line.committedAmountThb)}
        disabled={readOnly || isPending}
      />
      <td className="py-1.5 pr-2 text-right">
        <Currency
          amount={line.actualAmountThb}
          className={actualIsOverLimit ? 'font-medium text-destructive' : 'text-text-default'}
        />
      </td>
      <td className="w-24 py-1.5 pl-2 text-right">
        {readOnly ? null : (
          <div className="flex items-center justify-end gap-1">
            <AddTransactionDialog
              flipId={flipId}
              orgId={orgId}
              budgetLines={allLines}
              defaultKind="spend"
              defaultBudgetLineId={line.id}
              trigger={
                <button
                  type="button"
                  className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default"
                  aria-label={t('actions.addSpend')}
                  title={t('actions.addSpend')}
                >
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              }
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-50"
              aria-label={t('actions.deleteLine')}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {error ? <span className="sr-only">{error}</span> : null}
      </td>
    </tr>
  );
}

function AmountCell({
  initial,
  onCommit,
  disabled,
}: {
  initial: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
}) {
  const [raw, setRaw] = useState<string>(String(initial));

  return (
    <td className="py-1.5 pr-2">
      <input
        inputMode="decimal"
        type="text"
        value={formatWithCommas(raw)}
        onChange={(e) => setRaw(cleanNumericInput(e.target.value))}
        onBlur={() => {
          const parsed = parseAmount(raw);
          if (Number.isNaN(parsed)) {
            setRaw(String(initial));
            return;
          }
          onCommit(parsed);
          setRaw(String(parsed));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setRaw(String(initial));
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        className="tabular w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-text-default outline-none hover:border-border-subtle focus:border-border focus:bg-surface disabled:cursor-not-allowed"
      />
    </td>
  );
}
