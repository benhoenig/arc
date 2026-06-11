import { redirect } from 'next/navigation';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { getCurrentUser } from '@/server/auth';

type Props = {
  children: React.ReactNode;
};

export default async function AuthLayout({ children }: Props) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
