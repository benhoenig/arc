import { useLocale } from 'next-intl';
import { formatCurrency, formatPercent } from '@/lib/formatters/currency';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  amount: number;
  percent: number;
  locale?: Locale;
  className?: string;
};

function getVariantClass(percent: number): string {
  if (percent < -1) {
    return 'text-positive';
  }
  if (percent <= 1) {
    return 'text-text-default';
  }
  if (percent <= 10) {
    return 'text-warning';
  }
  return 'text-destructive';
}

export function Variance({ amount, percent, locale: localeProp, className }: Props) {
  const autoLocale = useLocale() as Locale;
  const locale = localeProp ?? autoLocale;

  const sign = amount > 0 ? '+' : '';
  const variantClass = getVariantClass(percent);

  return (
    <span
      className={cn('tabular whitespace-nowrap text-right font-medium', variantClass, className)}
    >
      {sign}
      {formatCurrency(amount, locale)} ({sign}
      {formatPercent(percent, locale)})
    </span>
  );
}
