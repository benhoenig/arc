'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { type Locale, locales } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = {
  th: 'ไทย',
  en: 'EN',
};

/**
 * Compact Thai/English toggle. Language is not a directional signal, so it
 * stays monochrome (active = strong text, inactive = muted) per the design
 * system. Switching re-navigates to the same path under the chosen locale;
 * next-intl persists the choice in the NEXT_LOCALE cookie.
 */
export function LocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const active = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    if (locale === active) {
      return;
    }
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <fieldset
      className="m-0 flex min-w-0 items-center rounded-md border border-border-subtle p-0"
      aria-label={t('label')}
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            disabled={isPending}
            aria-pressed={isActive}
            className={cn(
              'px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              isActive ? 'text-text-strong' : 'text-text-muted hover:text-text-default',
            )}
          >
            {LABELS[locale]}
          </button>
        );
      })}
    </fieldset>
  );
}
