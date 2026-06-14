'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '../actions/change-password';
import { changePasswordSchema } from '../validators/auth-schemas';

type FormValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const t = useTranslations('settings.account.password');
  const tErr = useTranslations('settings.account.password.errors');
  const [isPending, startTransition] = useTransition();
  const [succeeded, setSucceeded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Validation messages are stored as i18n keys; fall back to the raw value if a
  // key is ever missing rather than rendering nothing.
  function msg(key?: string): string | undefined {
    if (!key) {
      return undefined;
    }
    return tErr.has(key) ? tErr(key) : key;
  }

  function onSubmit(values: FormValues) {
    setSucceeded(false);
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        form.setError('currentPassword', {
          message: result.error === 'forbidden' ? 'invalidCurrent' : 'server',
        });
        return;
      }
      form.reset();
      setSucceeded(true);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-sm flex-col gap-4">
      {succeeded && <p className="text-sm text-positive">{t('success')}</p>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...form.register('currentPassword')}
        />
        {form.formState.errors.currentPassword && (
          <p className="text-xs text-destructive">
            {msg(form.formState.errors.currentPassword.message)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">{t('newPassword')}</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder={t('newPasswordPlaceholder')}
          {...form.register('newPassword')}
        />
        {form.formState.errors.newPassword && (
          <p className="text-xs text-destructive">
            {msg(form.formState.errors.newPassword.message)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...form.register('confirmPassword')}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {msg(form.formState.errors.confirmPassword.message)}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
