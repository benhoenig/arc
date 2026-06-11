'use client';

import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import {
  cleanNumericInput,
  formatWithCommas,
  parseAmount,
} from '@/features/budget/components/amount-input-helpers';
import { cn } from '@/lib/utils';
import { updateFlipOverheads } from '../actions/update-flip-overheads';

export type OverheadField = 'holding' | 'transaction' | 'selling' | 'marketing' | 'other';

type Props = {
  flipId: string;
  field: OverheadField;
  initial: number;
  disabled?: boolean;
};

export function FlipOverheadCell({ flipId, field, initial, disabled = false }: Props) {
  const [raw, setRaw] = useState<string>(String(initial));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  // When edits are not allowed (locked flip / no deal analysis) render the
  // plain currency value so the panel reads identically to before.
  if (disabled) {
    return <Currency amount={initial} />;
  }

  function commit() {
    const next = parseAmount(raw);
    if (Number.isNaN(next) || next < 0) {
      setRaw(String(initial));
      return;
    }
    if (next === initial) {
      return;
    }
    setError(false);
    startTransition(async () => {
      const result = await updateFlipOverheads({ flipId, [field]: next });
      if (result.ok) {
        setRaw(String(next));
      } else {
        setError(true);
        setRaw(String(initial));
      }
    });
  }

  return (
    <input
      inputMode="decimal"
      type="text"
      value={formatWithCommas(raw)}
      onChange={(e) => setRaw(cleanNumericInput(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setRaw(String(initial));
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={isPending}
      className={cn(
        'tabular w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-text-default outline-none hover:border-border-subtle focus:border-border focus:bg-surface disabled:cursor-not-allowed',
        error && 'border-destructive',
      )}
    />
  );
}
