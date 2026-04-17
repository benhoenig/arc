'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signup } from '../actions/signup';
import { signupSchema } from '../validators/auth-schemas';

export function SignupForm() {
  const t = useTranslations('auth.signup');
  const tErr = useTranslations('auth.errors');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', fullName: '', orgName: '' },
  });

  function onSubmit(values: z.infer<typeof signupSchema>) {
    startTransition(async () => {
      const result = await signup(values);
      if (!result.ok) {
        if (result.error === 'conflict') {
          form.setError('email', { message: tErr('emailTaken') });
          return;
        }
        form.setError('root', {
          message: tErr(result.error === 'validation' ? 'validation' : 'server'),
        });
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">{t('fullName')}</Label>
        <Input
          id="fullName"
          placeholder={t('fullNamePlaceholder')}
          autoComplete="name"
          {...form.register('fullName')}
        />
        {form.formState.errors.fullName && (
          <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          autoComplete="new-password"
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="orgName">{t('orgName')}</Label>
        <Input id="orgName" placeholder={t('orgNamePlaceholder')} {...form.register('orgName')} />
        {form.formState.errors.orgName && (
          <p className="text-xs text-destructive">{form.formState.errors.orgName.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
