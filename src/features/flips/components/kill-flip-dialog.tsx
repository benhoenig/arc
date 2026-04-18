'use client';

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
import { killFlip } from '../actions/kill-flip';
import { FLIP_KILL_REASONS, type FlipKillReason } from '../validators/flip-schemas';

type Props = {
  flipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KillFlipDialog({ flipId, open, onOpenChange }: Props) {
  const t = useTranslations('flips');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState<FlipKillReason>('deal_collapsed');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await killFlip({ id: flipId, reason, notes: notes || undefined });
      if (result.ok) {
        onOpenChange(false);
        setNotes('');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('kill.title')}</DialogTitle>
          <DialogDescription>{t('kill.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>{t('kill.reasonLabel')} *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as FlipKillReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLIP_KILL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`kill.reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('kill.notesLabel')}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? t('kill.confirming') : t('kill.confirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
