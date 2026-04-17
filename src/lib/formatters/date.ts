import type { Locale } from '@/lib/i18n';

export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (locale === 'th') {
    const beYear = d.getFullYear() + 543;
    const month = new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(d);
    const day = d.getDate();
    return `${day} ${month} ${beYear}`;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (locale === 'th') {
    const beYear = d.getFullYear() + 543;
    const month = new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(d);
    const day = d.getDate();
    return `${day} ${month} ${beYear}`;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatRelative(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return locale === 'th' ? 'วันนี้' : 'Today';
  }
  if (diffDays === 1) {
    return locale === 'th' ? 'เมื่อวาน' : 'Yesterday';
  }
  if (diffDays < 7) {
    return locale === 'th' ? `${diffDays} วันที่แล้ว` : `${diffDays} days ago`;
  }

  return formatDateShort(d, locale);
}
