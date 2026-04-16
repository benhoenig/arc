import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tApp = await getTranslations('app');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {tApp('name')}
      </p>
      <h1 className="text-3xl font-semibold leading-tight text-[color:var(--color-text-strong)]">
        {t('hello')}
      </h1>
      <p className="text-base text-[color:var(--color-text-default)]">{t('subtitle')}</p>
      <p className="text-sm text-[color:var(--color-text-muted)]">{t('description')}</p>
    </main>
  );
}
