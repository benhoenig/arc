import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@/lib/i18n';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // Keep Thai as the firm default: don't let the browser's Accept-Language
  // header (or a stale cookie) flip a fresh visitor to English. English is
  // reached explicitly via the `/en` prefix or the in-app language switcher.
  localeDetection: false,
});
