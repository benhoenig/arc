import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/features/auth/components/login-form';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('auth.login');
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

      <LoginForm />

      <p className="text-center text-sm text-text-muted">
        {t('noAccount')}{' '}
        <Link href="/signup" className="font-medium text-text-strong hover:underline">
          {t('signupLink')}
        </Link>
      </p>
    </div>
  );
}
