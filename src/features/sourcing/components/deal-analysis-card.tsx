'use client';

import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { Pill } from '@/components/data-display/pill';
import { ConfirmDeleteDialog } from '@/components/form/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import { CreateFlipFromDealDialog } from '@/features/flips/components/create-flip-from-deal-dialog';
import { Link } from '@/i18n/navigation';
import { deleteDealAnalysis } from '../actions/delete-deal-analysis';
import { recordDealDecision } from '../actions/record-deal-decision';
import { DealAnalysisForm } from './deal-analysis-form';

type DealAnalysis = {
  id: string;
  propertyId: string;
  label: string | null;
  flipType: string;
  estPurchasePriceThb: number;
  estRenovationCostThb: number;
  estSellingCostThb: number;
  estArvThb: number;
  estTimelineDays: number;
  estHoldingCostThb: number;
  estTransactionCostThb: number;
  depositAmountThb: number | null;
  contractMonths: number | null;
  marketingCostThb: number;
  otherCostThb: number;
  totalCostThb: number;
  estProfitThb: number;
  estMarginPct: number;
  estRoiPct: number;
  decision: string | null;
  flipId: string | null;
  createdAt: Date;
};

type Props = {
  analysis: DealAnalysis;
  propertyListingName?: string;
};

export function DealAnalysisCard({ analysis, propertyListingName }: Props) {
  const t = useTranslations('sourcing');
  const tFlips = useTranslations('flips');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasDecision = analysis.decision != null;
  const canConvert = analysis.decision === 'pursue' && analysis.flipId == null;
  const convertedFlipId = analysis.flipId;

  function handleDelete() {
    startTransition(async () => {
      await deleteDealAnalysis(analysis.id);
      setDeleteOpen(false);
    });
  }

  function handleDecision(decision: 'pursue' | 'pass') {
    startTransition(async () => {
      await recordDealDecision({ id: analysis.id, decision });
    });
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border p-4">
        <DealAnalysisForm
          propertyId={analysis.propertyId}
          initialAnalysis={analysis}
          onSuccess={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {analysis.label ? (
              <span className="text-sm font-medium text-text-strong">{analysis.label}</span>
            ) : null}
            <DateDisplay
              date={analysis.createdAt}
              format="short"
              className="text-sm text-text-muted"
            />
            <Pill>{t(`dealAnalysis.flipTypes.${analysis.flipType}`)}</Pill>
          </div>
          <div className="flex items-center gap-2">
            {analysis.decision && (
              <Pill
                variant={
                  analysis.decision === 'pursue'
                    ? 'positive'
                    : analysis.decision === 'pass'
                      ? 'muted'
                      : 'neutral'
                }
              >
                {t(`decision.${analysis.decision}`)}
              </Pill>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default"
              disabled={isPending}
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive"
              disabled={isPending}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <span className="text-text-muted">{t('dealAnalysis.totalCost')}: </span>
            <Currency amount={analysis.totalCostThb} className="font-medium" />
          </div>
          <div>
            <span className="text-text-muted">{t('dealAnalysis.profit')}: </span>
            <Currency amount={analysis.estProfitThb} className="font-medium" />
          </div>
          <div>
            <span className="text-text-muted">{t('dealAnalysis.margin')}: </span>
            <span className="tabular font-medium">{analysis.estMarginPct.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-text-muted">{t('dealAnalysis.roi')}: </span>
            <span className="tabular font-medium">{analysis.estRoiPct.toFixed(1)}%</span>
          </div>
        </div>

        {!hasDecision && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecision('pursue')}
              disabled={isPending}
            >
              {t('decision.pursue')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDecision('pass')}
              disabled={isPending}
            >
              {t('decision.pass')}
            </Button>
          </div>
        )}

        {canConvert && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={() => setConvertOpen(true)}>
              {tFlips('actions.convertToFlip')}
              <ArrowRight size={14} strokeWidth={1.5} className="ml-1" />
            </Button>
          </div>
        )}

        {convertedFlipId && (
          <div className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
            <Link
              href={`/flips/${convertedFlipId}`}
              className="inline-flex items-center gap-1 hover:text-text-default hover:underline"
            >
              {tFlips('actions.convertToFlip')}
              <ArrowRight size={12} strokeWidth={1.5} />
            </Link>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('dealAnalysis.deleteTitle')}
        description={t('dealAnalysis.deleteDescription')}
        onConfirm={handleDelete}
        isPending={isPending}
      />

      {canConvert && (
        <CreateFlipFromDealDialog
          dealAnalysisId={analysis.id}
          defaultName={propertyListingName ?? analysis.label ?? ''}
          open={convertOpen}
          onOpenChange={setConvertOpen}
        />
      )}
    </>
  );
}
