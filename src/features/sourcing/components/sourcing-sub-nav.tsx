'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'properties', href: '/sourcing/properties' },
  { key: 'contacts', href: '/sourcing/contacts' },
  { key: 'projects', href: '/sourcing/projects' },
] as const;

export function SourcingSubNav() {
  const t = useTranslations('sourcing.nav');
  const pathname = usePathname();

  return (
    <nav className="border-b border-border">
      <div className="flex gap-6 px-6">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                '-mb-px border-b-2 pb-2 pt-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-text-strong text-text-strong'
                  : 'border-transparent text-text-muted hover:text-text-default',
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
