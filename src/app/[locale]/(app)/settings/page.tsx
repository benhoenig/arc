import { Sparkles, Tags, UserCircle, UserCog } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { isOrgAdmin } from '@/server/shared/require-admin';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const [isAdmin, t] = await Promise.all([
    isOrgAdmin(user.id, orgId),
    getTranslations('settings.hub'),
  ]);

  const cards = [
    { key: 'account', href: '/settings/account', icon: UserCircle, adminOnly: false },
    { key: 'ai', href: '/settings/ai', icon: Sparkles, adminOnly: true },
    { key: 'members', href: '/settings/members', icon: UserCog, adminOnly: true },
    { key: 'budgetCategories', href: '/settings/budget-categories', icon: Tags, adminOnly: true },
  ] as const;

  const visible = cards.filter((c) => isAdmin || !c.adminOnly);

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-strong">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface px-4 py-3 transition-colors hover:bg-fill-hover"
          >
            <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-muted" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-strong">{t(`${key}.title`)}</span>
              <span className="text-xs text-text-muted">{t(`${key}.description`)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
