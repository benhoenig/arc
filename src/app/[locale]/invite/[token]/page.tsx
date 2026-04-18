import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AcceptInvitationForm } from '@/features/members/components/accept-invitation-form';
import { getInvitationByToken } from '@/features/members/queries/get-invitation-by-token';

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function InviteAcceptPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const invitation = await getInvitationByToken(token);
  const t = await getTranslations('members.accept');
  const tApp = await getTranslations('app');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {tApp('name')}
          </p>
          {invitation ? (
            <>
              <h1 className="text-2xl font-semibold text-text-strong">{t('title')}</h1>
              <p className="text-sm text-text-muted">
                {t('invitedTo')}{' '}
                <span className="font-medium text-text-default">{invitation.organizationName}</span>{' '}
                {t('asRole')}{' '}
                <span className="font-medium text-text-default">
                  {locale === 'en' && invitation.role.nameEn
                    ? invitation.role.nameEn
                    : invitation.role.nameTh}
                </span>
                .
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-text-strong">{t('invalid.title')}</h1>
              <p className="text-sm text-text-muted">{t('invalid.description')}</p>
            </>
          )}
        </div>

        {invitation ? <AcceptInvitationForm token={token} email={invitation.email} /> : null}
      </div>
    </div>
  );
}
