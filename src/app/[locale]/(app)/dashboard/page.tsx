import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('nav');
  const tApp = await getTranslations('app');

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-semibold text-text-strong">{t('dashboard')}</h1>
      <p className="mt-2 text-sm text-text-muted">{tApp('tagline')}</p>
    </div>
  );
}
