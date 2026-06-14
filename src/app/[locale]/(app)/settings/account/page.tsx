import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { requireAuth } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireAuth();
  const t = await getTranslations('settings.account');

  return (
    <div className="flex flex-col gap-8 px-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-strong">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-strong">{t('profileTitle')}</h2>
        <dl className="flex max-w-sm flex-col gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{t('name')}</dt>
            <dd className="text-text-default">{user.name ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{t('email')}</dt>
            <dd className="text-text-default">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-strong">{t('password.title')}</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
