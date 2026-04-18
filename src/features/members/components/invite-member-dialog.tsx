'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createInvitation } from '../actions/create-invitation';
import { INVITABLE_ROLE_SLUGS, type InvitableRoleSlug } from '../validators/invitation-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleLabels: Record<InvitableRoleSlug, string>;
};

export function InviteMemberDialog({ open, onOpenChange, roleLabels }: Props) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [roleSlug, setRoleSlug] = useState<InvitableRoleSlug>('pm');
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail('');
    setRoleSlug('pm');
    setError(null);
    setGenerated(null);
    setCopied(false);
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createInvitation({ email: email.trim(), roleSlug });
      if (!result.ok) {
        if (result.error === 'conflict') {
          const code = result.message ?? '';
          if (code === 'duplicate') {
            setError(t('errors.duplicate'));
            return;
          }
          if (code === 'already_member') {
            setError(t('errors.alreadyMember'));
            return;
          }
        }
        if (result.error === 'forbidden') {
          setError(t('errors.forbidden'));
          return;
        }
        setError(t('errors.server'));
        return;
      }
      const url = `${window.location.origin}/invite/${result.data.rawToken}`;
      setGenerated({ url });
    });
  }

  async function copyLink() {
    if (!generated) {
      return;
    }
    await navigator.clipboard.writeText(generated.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{generated ? t('invite.successTitle') : t('invite.title')}</DialogTitle>
          <DialogDescription>
            {generated ? t('invite.successDescription') : t('invite.description')}
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface p-2">
              <code className="flex-1 truncate font-mono text-xs text-text-default">
                {generated.url}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={1.5} className="mr-1" />
                    {t('invitations.copied')}
                  </>
                ) : (
                  <>
                    <Copy size={14} strokeWidth={1.5} className="mr-1" />
                    {tCommon('copy')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-text-muted">{t('invitations.reissueNote')}</p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>{t('invite.close')}</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{t('invite.emailLabel')} *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('invite.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('invite.roleLabel')} *</Label>
              <Select value={roleSlug} onValueChange={(v) => setRoleSlug(v as InvitableRoleSlug)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLE_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {roleLabels[slug]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending || email.trim().length === 0}>
                {isPending ? t('invite.submitting') : t('invite.submit')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
