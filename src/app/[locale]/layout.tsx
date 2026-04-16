import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
// Side-effect import: forces zod validation of env vars at server boot.
// If anything is missing or malformed, the app fails loud on first render.
import '@/lib/env';
import type { Locale } from '@/lib/i18n';
import { fontMono, fontSans } from '../fonts';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });

  return {
    title: t('name'),
    description: t('tagline'),
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale as Locale);

  return (
    <html lang={locale} className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
