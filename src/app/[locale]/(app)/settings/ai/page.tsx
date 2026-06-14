import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UsageSummaryPanel } from '@/features/ai-usage/components/usage-summary-panel';
import { getAiUsageSummary } from '@/features/ai-usage/queries/get-usage-summary';
import { AiSettingsForm } from '@/features/settings/components/ai-settings-form';
import { getAiSettings } from '@/features/settings/queries/get-ai-settings';
import { redirect } from '@/i18n/navigation';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { isOrgAdmin } from '@/server/shared/require-admin';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AiSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  // AI settings hold an org-wide, billing-sensitive secret — admin only.
  if (!(await isOrgAdmin(user.id, orgId))) {
    redirect({ href: '/settings', locale });
  }

  const [status, usage, t] = await Promise.all([
    getAiSettings(orgId),
    getAiUsageSummary(orgId),
    getTranslations('settings.ai'),
  ]);

  return (
    <div className="flex flex-col gap-8 px-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-strong">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('subtitle')}</p>
      </header>

      <AiSettingsForm status={status} />
      <UsageSummaryPanel summary={usage} />
    </div>
  );
}
