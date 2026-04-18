'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInvitation } from '../actions/accept-invitation';

type Props = {
  token: string;
  email: string;
};

export function AcceptInvitationForm({ token, email }: Props) {
  const t = useTranslations('members.accept');
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation({ token, fullName: fullName.trim(), password });
      if (!result.ok) {
        if (result.error === 'conflict') {
          const code = result.message ?? '';
          if (code === 'email_mismatch') {
            setError(t('errors.emailMismatch'));
            return;
          }
          if (code === 'already_member') {
            setError(t('errors.alreadyMember'));
            return;
          }
          if (code === 'email_taken') {
            setError(t('errors.emailTaken'));
            return;
          }
        }
        setError(t('errors.server'));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} disabled readOnly />
        <p className="text-xs text-text-muted">{t('emailLocked')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">{t('fullName')} *</Label>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')} *</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        disabled={isPending || fullName.trim().length === 0 || password.length < 8}
        className="w-full"
      >
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
