import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SignupForm } from '@/features/auth/components/signup-form';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SignupPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('auth.signup');
  const tApp = await getTranslations('app');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {tApp('name')}
        </p>
        <h1 className="text-2xl font-semibold text-text-strong">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('subtitle')}</p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-text-muted">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-text-strong hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
