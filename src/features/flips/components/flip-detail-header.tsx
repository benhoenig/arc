'use client';

import { Calculator, MoreHorizontal, Repeat, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pill } from '@/components/data-display/pill';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getThumbnailUrl } from '@/lib/property-thumbnail';
import type { FlipStageOption } from '../queries/list-flip-stages';
import { FlipStageSelect } from './flip-stage-select';
import { KillFlipDialog } from './kill-flip-dialog';
import { PivotToTransferInDialog } from './pivot-to-transfer-in-dialog';
import { ReUnderwriteDialog } from './re-underwrite-dialog';
import { ReviveFlipDialog } from './revive-flip-dialog';

type Props = {
  flipId: string;
  code: string;
  name: string;
  stageId: string;
  stageSlug: string;
  stageLabel: string;
  property: {
    id: string;
    listingName: string;
    thumbnailPath: string | null;
  };
  isOnHold: boolean;
  soldAt: Date | null;
  killedAt: Date | null;
  stages: FlipStageOption[];
  flipType: 'float_flip' | 'transfer_in';
  revisionDefaults: {
    originalContractPriceThb?: number;
    revisedTargetArvThb?: number;
    revisedTargetTimelineDays?: number;
  };
};

export function FlipDetailHeader({
  flipId,
  code,
  name,
  stageId,
  stageSlug,
  stageLabel,
  property,
  isOnHold,
  soldAt,
  killedAt,
  stages,
  flipType,
  revisionDefaults,
}: Props) {
  const t = useTranslations('flips');
  const [killOpen, setKillOpen] = useState(false);
  const [reviveOpen, setReviveOpen] = useState(false);
  const [reunderwriteOpen, setReunderwriteOpen] = useState(false);
  const [pivotOpen, setPivotOpen] = useState(false);

  const isKilled = stageSlug === 'killed' || killedAt != null;
  const isSold = stageSlug === 'sold' || soldAt != null;
  const locked = isKilled || isSold;
  const isTerminal = locked;

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {property.thumbnailPath ? (
          // biome-ignore lint/performance/noImgElement: user-uploaded dynamic URL
          <img
            src={getThumbnailUrl(property.thumbnailPath) ?? ''}
            alt=""
            className="h-24 w-24 rounded-md border border-border-subtle object-cover"
          />
        ) : (
          <div className="h-24 w-24 rounded-md border border-border-subtle bg-surface" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-muted">{code}</span>
            {isOnHold && !isTerminal ? <Pill variant="warning">{t('detail.onHold')}</Pill> : null}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1
              className={`text-2xl font-semibold ${isTerminal ? 'text-text-muted' : 'text-text-strong'}`}
            >
              {name}
            </h1>
            <Pill variant={isTerminal ? 'muted' : 'neutral'}>{stageLabel}</Pill>
          </div>
          <Link
            href={`/sourcing/properties/${property.id}`}
            className="mt-1 inline-block text-sm text-text-muted hover:text-text-default hover:underline"
          >
            {property.listingName}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <FlipStageSelect flipId={flipId} currentStageId={stageId} locked={locked} stages={stages} />
        {!locked ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setReunderwriteOpen(true)}>
              <Calculator size={14} strokeWidth={1.5} className="mr-1" />
              {t('actions.reunderwrite')}
            </Button>
            {flipType === 'float_flip' ? (
              <Button variant="outline" size="sm" onClick={() => setPivotOpen(true)}>
                <Repeat size={14} strokeWidth={1.5} className="mr-1" />
                {t('actions.pivot')}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setKillOpen(true)}
              className="text-text-muted hover:text-destructive"
            >
              <MoreHorizontal size={14} strokeWidth={1.5} className="mr-1" />
              {t('actions.kill')}
            </Button>
          </>
        ) : null}
        {isKilled ? (
          <Button variant="outline" size="sm" onClick={() => setReviveOpen(true)}>
            <Undo2 size={14} strokeWidth={1.5} className="mr-1" />
            {t('actions.revive')}
          </Button>
        ) : null}
      </div>

      <KillFlipDialog flipId={flipId} open={killOpen} onOpenChange={setKillOpen} />
      {isKilled ? (
        <ReviveFlipDialog
          flipId={flipId}
          open={reviveOpen}
          onOpenChange={setReviveOpen}
          stages={stages}
        />
      ) : null}
      {!locked ? (
        <>
          <ReUnderwriteDialog
            flipId={flipId}
            flipType={flipType}
            open={reunderwriteOpen}
            onOpenChange={setReunderwriteOpen}
            defaults={revisionDefaults}
          />
          {flipType === 'float_flip' ? (
            <PivotToTransferInDialog
              flipId={flipId}
              open={pivotOpen}
              onOpenChange={setPivotOpen}
              defaults={revisionDefaults}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
