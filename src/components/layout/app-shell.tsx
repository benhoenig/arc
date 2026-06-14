'use client';

import {
  HardHat,
  Layers,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search as SearchIcon,
  SlidersHorizontal,
  Store,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Topbar } from './topbar';

type Props = {
  orgName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

type NavItem = { key: string; href: string; icon: LucideIcon };

// Personal, cross-flip views stand alone above the operational groups — the
// overview and the operator's own task inbox.
const PERSONAL_NAV: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'myTasks', href: '/my-tasks', icon: ListChecks },
];

// Operational nav, grouped: "operations" is the workflows/queues you act on
// (the find → flip → sell pipeline, plus the contractor-payment queue);
// "partners" is the directories of who you work with.
const NAV_GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: 'operations',
    items: [
      { key: 'sourcing', href: '/sourcing', icon: SearchIcon },
      { key: 'flips', href: '/flips', icon: Layers },
      { key: 'payments', href: '/contractors/payments', icon: Wallet },
      { key: 'listings', href: '/listings', icon: Store },
    ],
  },
  {
    key: 'partners',
    items: [
      { key: 'contractors', href: '/contractors', icon: HardHat },
      { key: 'investors', href: '/investors', icon: Users },
    ],
  },
];

// Org setup / admin — pinned to the bottom of the sidebar, separated from the
// operational nav above. Both route into /settings/*.
const SETTINGS_NAV = [
  { key: 'members', href: '/settings/members', icon: UserCog },
  { key: 'settings', href: '/settings', icon: SlidersHorizontal },
] as const;

// Every nav href, used to resolve the single active item by LONGEST match — so a
// parent route (e.g. /contractors) isn't highlighted when a more specific
// sibling (e.g. /contractors/payments) is the page. Same for /settings vs
// /settings/members.
const ALL_NAV_HREFS: string[] = [
  ...PERSONAL_NAV,
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...SETTINGS_NAV,
].map((i) => i.href);

const MOBILE_TABS = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'flips', href: '/flips', icon: Layers },
  { key: 'contractors', href: '/contractors', icon: HardHat },
  { key: 'investors', href: '/investors', icon: Users },
  { key: 'settings', href: '/settings', icon: SlidersHorizontal },
] as const;

const SIDEBAR_STORAGE_KEY = 'arc.sidebarCollapsed';

export function AppShell({ orgName, userName, userEmail, children }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
    setHasLoadedSidebarPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference) {
      return;
    }
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [hasLoadedSidebarPreference, isSidebarCollapsed]);

  const cleanPath = pathname.replace(/^\/(th|en)/, '') || '/';
  // The active item is the longest href that matches the current path (exact or
  // as a prefix), so the most specific route wins and parents don't co-highlight.
  const activeHref = ALL_NAV_HREFS.filter(
    (href) => cleanPath === href || cleanPath.startsWith(`${href}/`),
  ).sort((a, b) => b.length - a.length)[0];

  function isActive(href: string): boolean {
    return href === activeHref;
  }

  function renderNavItem({ key, href, icon: Icon }: NavItem) {
    return (
      <Link
        key={key}
        href={href}
        aria-label={isSidebarCollapsed ? t(key) : undefined}
        title={isSidebarCollapsed ? t(key) : undefined}
        className={cn(
          'flex h-8 items-center rounded-md text-sm transition-colors',
          isSidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
          isActive(href)
            ? 'bg-fill-selected font-medium text-text-strong'
            : 'text-text-muted hover:bg-fill-hover hover:text-text-default',
        )}
      >
        <Icon size={16} strokeWidth={1.5} />
        {isSidebarCollapsed ? null : <span className="truncate">{t(key)}</span>}
      </Link>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border-subtle bg-surface transition-[width] duration-200 md:flex',
          isSidebarCollapsed ? 'w-14' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-12 items-center gap-2 border-b border-border-subtle px-2',
            isSidebarCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {isSidebarCollapsed ? null : (
            <span className="min-w-0 truncate px-2 text-sm font-semibold text-text-strong">
              {orgName}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.5} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.5} />
            )}
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-2">
          <div className="flex flex-col gap-0.5">{PERSONAL_NAV.map(renderNavItem)}</div>

          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              {isSidebarCollapsed ? null : (
                <p className="px-3 pb-0.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {t(`groups.${group.key}`)}
                </p>
              )}
              {group.items.map(renderNavItem)}
            </div>
          ))}

          <div className="mt-auto flex flex-col gap-0.5 border-t border-border-subtle pt-2">
            {SETTINGS_NAV.map(renderNavItem)}
          </div>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar orgName={orgName} userName={userName} userEmail={userEmail} />

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-around border-t border-border-subtle bg-background md:hidden">
        {MOBILE_TABS.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1',
              isActive(href) ? 'text-text-strong' : 'text-text-muted',
            )}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">{t(key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
