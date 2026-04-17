import { useLocale } from 'next-intl';
import { formatDate, formatDateShort, formatRelative } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  date: Date | string;
  format?: 'long' | 'short' | 'relative';
  locale?: Locale;
  className?: string;
};

export function DateDisplay({ date, format = 'long', locale: localeProp, className }: Props) {
  const autoLocale = useLocale() as Locale;
  const locale = localeProp ?? autoLocale;

  const formatters = {
    long: formatDate,
    short: formatDateShort,
    relative: formatRelative,
  };

  return (
    <time className={cn('whitespace-nowrap', className)}>{formatters[format](date, locale)}</time>
  );
}
