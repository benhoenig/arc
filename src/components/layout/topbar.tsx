'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { logout } from '@/features/auth/actions/logout';

type Props = {
  orgName: string;
  userName: string;
  userEmail: string;
};

export function Topbar({ userName, userEmail }: Props) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-background px-4">
      <div className="md:hidden">
        <span className="text-sm font-semibold text-text-strong">ARC</span>
      </div>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-text-default">{userName}</p>
          <p className="text-xs text-text-muted">{userEmail}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isPending}
          aria-label={t('logout')}
        >
          <LogOut size={16} strokeWidth={1.5} />
        </Button>
      </div>
    </header>
  );
}
