'use client';

import {
  HardHat,
  Layers,
  LayoutDashboard,
  Search as SearchIcon,
  SlidersHorizontal,
  Store,
  Users,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Topbar } from './topbar';

type Props = {
  orgName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'sourcing', href: '/sourcing', icon: SearchIcon },
  { key: 'flips', href: '/flips', icon: Layers },
  { key: 'contractors', href: '/contractors', icon: HardHat },
  { key: 'investors', href: '/investors', icon: Users },
  { key: 'listings', href: '/listings', icon: Store },
] as const;

const MOBILE_TABS = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'flips', href: '/flips', icon: Layers },
  { key: 'contractors', href: '/contractors', icon: HardHat },
  { key: 'investors', href: '/investors', icon: Users },
  { key: 'settings', href: '/settings', icon: SlidersHorizontal },
] as const;

export function AppShell({ orgName, userName, userEmail, children }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const clean = pathname.replace(/^\/(th|en)/, '') || '/';
    return clean === href || clean.startsWith(`${href}/`);
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-surface md:flex">
        <div className="flex h-12 items-center px-4">
          <span className="text-sm font-semibold text-text-strong">{orgName}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive(href)
                  ? 'bg-fill-selected font-medium text-text-strong'
                  : 'text-text-muted hover:bg-fill-hover hover:text-text-default',
              )}
            >
              <Icon size={16} strokeWidth={1.5} />
              {t(key)}
            </Link>
          ))}
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
