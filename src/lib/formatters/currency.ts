import type { Locale } from '@/lib/i18n';

export function formatCurrency(amount: number | bigint, locale: Locale): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount;

  if (locale === 'th') {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US').format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}
