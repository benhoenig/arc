'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pill } from '@/components/data-display/pill';
import { formatCurrency } from '@/lib/formatters/currency';
import type { Locale } from '@/lib/i18n';

type Props = {
  cashBalanceThb: number;
  transactionCount: number;
};

// Non-directional indicator of the flip's current cash pool. Neutral if zero,
// positive when the pool is funded (investor deposits/loans not yet spent),
// destructive when negative (overspent — bad and rare). Matches the
// directionality test in DESIGN_SYSTEM.md §2.2: "cash on hand" has an
// objectively better/worse version, so color is allowed.
export function FlipCashBalanceIndicator({ cashBalanceThb, transactionCount }: Props) {
  const t = useTranslations('budget');
  const locale = useLocale() as Locale;

  if (transactionCount === 0) {
    return <Pill variant="muted">{t('transactions.cashBalanceEmpty')}</Pill>;
  }

  const variant = cashBalanceThb < 0 ? 'destructive' : cashBalanceThb > 0 ? 'positive' : 'neutral';

  return (
    <Pill variant={variant}>
      {t('transactions.cashBalanceLabel')} {formatCurrency(cashBalanceThb, locale)}
    </Pill>
  );
}
