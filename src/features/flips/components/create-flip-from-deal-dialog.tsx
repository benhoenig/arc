'use client';

import { useRouter } from 'next/navigation';
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
import { createFlip } from '../actions/create-flip';
import { FLIP_CREATE_START_STAGES } from '../validators/flip-schemas';

type Props = {
  dealAnalysisId: string;
  defaultName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateFlipFromDealDialog({
  dealAnalysisId,
  defaultName,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations('flips');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [startStage, setStartStage] =
    useState<(typeof FLIP_CREATE_START_STAGES)[number]>('acquiring');
  const [hasInvestorCapital, setHasInvestorCapital] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createFlip({
        dealAnalysisId,
        name: name.trim(),
        startStageSlug: startStage,
        hasInvestorCapital,
      });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        return;
      }
      onOpenChange(false);
      router.push(`/flips/${result.data.flipId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>{t('create.nameLabel')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            <p className="text-xs text-text-muted">{t('create.nameHelp')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('create.stageLabel')}</Label>
            <Select
              value={startStage}
              onValueChange={(v) => setStartStage(v as (typeof FLIP_CREATE_START_STAGES)[number])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLIP_CREATE_START_STAGES.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {t(`stages.${slug}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasInvestorCapital}
              onChange={(e) => setHasInvestorCapital(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong"
            />
            <span>{t('create.hasInvestorLabel')}</span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || name.trim().length === 0}>
              {isPending ? t('create.submitting') : t('create.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
