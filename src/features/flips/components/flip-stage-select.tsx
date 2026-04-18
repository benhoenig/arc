'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { moveFlipToStage } from '../actions/move-flip-to-stage';
import type { FlipStageOption } from '../queries/list-flip-stages';

type Props = {
  flipId: string;
  currentStageId: string;
  locked: boolean;
  stages: FlipStageOption[];
};

export function FlipStageSelect({ flipId, currentStageId, locked, stages }: Props) {
  const t = useTranslations('flips');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

  // Hide `killed` from the picker — users must use the kill flow for reason capture.
  const selectable = stages.filter((s) => s.slug !== 'killed');

  function doMove(stageId: string) {
    startTransition(async () => {
      await moveFlipToStage({ id: flipId, stageId });
      setConfirmOpen(false);
      setPendingStageId(null);
    });
  }

  function onChange(stageId: string) {
    if (stageId === currentStageId) {
      return;
    }
    const target = stages.find((s) => s.id === stageId);
    if (!target) {
      return;
    }
    if (target.stageType === 'terminal') {
      setPendingStageId(stageId);
      setConfirmOpen(true);
    } else {
      doMove(stageId);
    }
  }

  if (locked) {
    const current = stages.find((s) => s.id === currentStageId);
    const label = current
      ? locale === 'en' && current.nameEn
        ? current.nameEn
        : current.nameTh
      : '';
    return (
      <div className="flex flex-col gap-1">
        <div className="inline-flex min-w-[10rem] items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-muted">
          <span>{label}</span>
        </div>
        <p className="text-xs text-text-muted">{t('stage.blockedFromTerminal')}</p>
      </div>
    );
  }

  return (
    <>
      <Select value={currentStageId} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger className="w-[12rem]">
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.changeStage')}</AlertDialogTitle>
            <AlertDialogDescription>{t('stage.confirmTerminal')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingStageId) {
                  doMove(pendingStageId);
                }
              }}
              disabled={isPending}
            >
              {t('actions.changeStage')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
