import { useLocale } from 'next-intl';
import { formatCurrency } from '@/lib/formatters/currency';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  amount: number;
  locale?: Locale;
  className?: string;
};

export function Currency({ amount, locale: localeProp, className }: Props) {
  const autoLocale = useLocale() as Locale;
  const locale = localeProp ?? autoLocale;

  return (
    <span className={cn('tabular whitespace-nowrap text-right', className)}>
      {formatCurrency(amount, locale)}
    </span>
  );
}
