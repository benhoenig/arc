import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/supabase/auth';

type Props = {
  children: React.ReactNode;
};

export default async function AuthLayout({ children }: Props) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
