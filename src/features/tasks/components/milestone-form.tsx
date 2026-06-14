'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createMilestone } from '../actions/create-milestone';
import { updateMilestone } from '../actions/update-milestone';
import type { FlipMilestone } from '../queries/list-milestones-for-flip';

function toDateInput(date: Date | string | null): string {
  if (date == null) {
    return '';
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

type Props = {
  flipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: FlipMilestone;
};

export function MilestoneForm({ flipId, open, onOpenChange, milestone }: Props) {
  const t = useTranslations('tasks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const isEdit = milestone != null;

  const [title, setTitle] = useState(milestone?.title ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [targetDate, setTargetDate] = useState(toDateInput(milestone?.targetDate ?? null));
  const [isCritical, setIsCritical] = useState(milestone?.isCritical ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0 || targetDate === '') {
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateMilestone({
            id: milestone.id,
            title: trimmed,
            description: description.trim() === '' ? null : description.trim(),
            targetDate,
            isCritical,
          })
        : await createMilestone({
            flipId,
            title: trimmed,
            description: description.trim() === '' ? undefined : description.trim(),
            targetDate,
            isCritical,
          });

      if (!result.ok) {
        setError(result.error === 'validation' ? t('errors.validation') : t('errors.server'));
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('timeline.form.editTitle') : t('timeline.form.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('timeline.form.title')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('timeline.form.titlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('timeline.form.description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('timeline.form.targetDate')} *</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-default">
            <input
              type="checkbox"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="size-4 rounded border-border accent-text-strong"
            />
            {t('timeline.form.critical')}
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending || title.trim().length === 0 || targetDate === ''}
            >
              {isEdit ? tCommon('save') : tCommon('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
