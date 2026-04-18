'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Allow decimal input (default: false) */
  decimal?: boolean;
};

function formatWithCommas(value: number | undefined, decimal?: boolean): string {
  if (value === undefined || Number.isNaN(value)) {
    return '';
  }
  if (decimal) {
    const parts = value.toString().split('.');
    parts[0] = Number(parts[0]).toLocaleString('en-US');
    return parts.join('.');
  }
  return value.toLocaleString('en-US');
}

function stripToNumber(raw: string): number | undefined {
  const stripped = raw.replace(/,/g, '');
  if (stripped === '' || stripped === '-') {
    return undefined;
  }
  const num = Number(stripped);
  return Number.isNaN(num) ? undefined : num;
}

export function NumberInput({ value, onChange, decimal, className, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const displayValue = focused ? rawText : formatWithCommas(value, decimal);

  function handleFocus() {
    setFocused(true);
    setRawText(value !== undefined && !Number.isNaN(value) ? String(value) : '');
  }

  function handleBlur() {
    setFocused(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const allowed = decimal ? /^-?[\d,]*\.?\d*$/ : /^-?[\d,]*$/;
    if (raw === '' || allowed.test(raw)) {
      setRawText(raw);
      onChangeRef.current(stripToNumber(raw));
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn('tabular', className)}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      {...props}
    />
  );
}
