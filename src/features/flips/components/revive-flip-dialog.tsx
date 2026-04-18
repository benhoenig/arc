'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { reviveFlip } from '../actions/revive-flip';
import type { FlipStageOption } from '../queries/list-flip-stages';

type Props = {
  flipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FlipStageOption[];
};

export function ReviveFlipDialog({ flipId, open, onOpenChange, stages }: Props) {
  const t = useTranslations('flips');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  // Only non-terminal stages are valid revive targets; default to `acquiring`
  // if present since most reviveable kills happen mid-pre-acquisition.
  const selectable = stages.filter((s) => s.slug !== 'killed' && s.slug !== 'sold');
  const defaultId = selectable.find((s) => s.slug === 'acquiring')?.id ?? selectable[0]?.id ?? '';

  const [stageId, setStageId] = useState(defaultId);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!stageId) {
      return;
    }
    startTransition(async () => {
      const result = await reviveFlip({ id: flipId, stageId });
      if (result.ok) {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('revive.title')}</DialogTitle>
          <DialogDescription>{t('revive.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>{t('revive.stageLabel')} *</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {locale === 'en' && s.nameEn ? s.nameEn : s.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !stageId}>
              {isPending ? t('revive.confirming') : t('revive.confirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
