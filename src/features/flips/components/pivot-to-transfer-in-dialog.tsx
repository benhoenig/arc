'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { NumberInput } from '@/components/form/number-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createFlipRevision } from '../actions/create-flip-revision';
import { computeFlipRevisionTotals } from '../validators/flip-schemas';

type Props = {
  flipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: {
    revisedTargetArvThb?: number;
    revisedTargetTimelineDays?: number;
  };
};

type FormState = {
  reasonNotes: string;
  sunkDepositThb: number | undefined;
  sunkRenoSpentThb: number | undefined;
  sunkMarketingSpentThb: number | undefined;
  sunkOtherThb: number | undefined;
  newRemainingPropertyCostThb: number | undefined;
  newTransferFeesCashThb: number | undefined;
  newTransferFeesLoanThb: number | undefined;
  newLoanOriginationThb: number | undefined;
  newRenoBudgetThb: number | undefined;
  revisedTargetArvThb: number | undefined;
  revisedTargetTimelineDays: number | undefined;
};

function initialState(defaults?: Props['defaults']): FormState {
  return {
    reasonNotes: '',
    sunkDepositThb: undefined,
    sunkRenoSpentThb: undefined,
    sunkMarketingSpentThb: undefined,
    sunkOtherThb: undefined,
    newRemainingPropertyCostThb: undefined,
    newTransferFeesCashThb: undefined,
    newTransferFeesLoanThb: undefined,
    newLoanOriginationThb: undefined,
    newRenoBudgetThb: undefined,
    revisedTargetArvThb: defaults?.revisedTargetArvThb,
    revisedTargetTimelineDays: defaults?.revisedTargetTimelineDays,
  };
}

/**
 * Pivot buy-in dialog for a float flip that's expiring. Collects the sunk
 * costs from the abandoned float attempt and the new capital required to
 * take transfer; profit uses full-ARV math since you now own the unit.
 */
export function PivotToTransferInDialog({ flipId, open, onOpenChange, defaults }: Props) {
  const t = useTranslations('flips.pivot');
  const tShared = useTranslations('flips.revisionShared');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<FormState>(() => initialState(defaults));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const computed = useMemo(
    () =>
      computeFlipRevisionTotals('pivot_to_transfer_in', {
        sunkDepositThb: form.sunkDepositThb ?? 0,
        sunkRenoSpentThb: form.sunkRenoSpentThb ?? 0,
        sunkMarketingSpentThb: form.sunkMarketingSpentThb ?? 0,
        sunkOtherThb: form.sunkOtherThb ?? 0,
        newRemainingPropertyCostThb: form.newRemainingPropertyCostThb ?? 0,
        newTransferFeesCashThb: form.newTransferFeesCashThb ?? 0,
        newTransferFeesLoanThb: form.newTransferFeesLoanThb ?? 0,
        newLoanOriginationThb: form.newLoanOriginationThb ?? 0,
        newRenoBudgetThb: form.newRenoBudgetThb ?? 0,
        revisedTargetArvThb: form.revisedTargetArvThb ?? 0,
      }),
    [form],
  );

  const canSubmit =
    (form.revisedTargetArvThb ?? 0) > 0 && (form.revisedTargetTimelineDays ?? 0) > 0;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(initialState(defaults));
    setError(null);
    onOpenChange(false);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createFlipRevision({
        flipId,
        revisionType: 'pivot_to_transfer_in',
        reasonNotes: form.reasonNotes || undefined,
        sunkDepositThb: form.sunkDepositThb ?? 0,
        sunkRenoSpentThb: form.sunkRenoSpentThb ?? 0,
        sunkMarketingSpentThb: form.sunkMarketingSpentThb ?? 0,
        sunkOtherThb: form.sunkOtherThb ?? 0,
        newRemainingPropertyCostThb: form.newRemainingPropertyCostThb ?? 0,
        newTransferFeesCashThb: form.newTransferFeesCashThb ?? 0,
        newTransferFeesLoanThb: form.newTransferFeesLoanThb ?? 0,
        newLoanOriginationThb: form.newLoanOriginationThb ?? 0,
        newRenoBudgetThb: form.newRenoBudgetThb ?? 0,
        revisedTargetArvThb: form.revisedTargetArvThb ?? 0,
        revisedTargetTimelineDays: form.revisedTargetTimelineDays ?? 0,
      });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        return;
      }
      handleClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label>{tShared('reasonLabel')}</Label>
            <Input
              value={form.reasonNotes}
              onChange={(e) => set('reasonNotes', e.target.value)}
              maxLength={2000}
            />
          </div>

          <Section title={tShared('sunkSection')}>
            <Field label={tShared('sunkDeposit')}>
              <NumberInput value={form.sunkDepositThb} onChange={(v) => set('sunkDepositThb', v)} />
            </Field>
            <Field label={tShared('sunkReno')}>
              <NumberInput
                value={form.sunkRenoSpentThb}
                onChange={(v) => set('sunkRenoSpentThb', v)}
              />
            </Field>
            <Field label={tShared('sunkMarketing')}>
              <NumberInput
                value={form.sunkMarketingSpentThb}
                onChange={(v) => set('sunkMarketingSpentThb', v)}
              />
            </Field>
            <Field label={tShared('sunkOther')}>
              <NumberInput value={form.sunkOtherThb} onChange={(v) => set('sunkOtherThb', v)} />
            </Field>
          </Section>

          <Section title={t('newSection')}>
            <Field label={t('newPropertyCost')}>
              <NumberInput
                value={form.newRemainingPropertyCostThb}
                onChange={(v) => set('newRemainingPropertyCostThb', v)}
              />
            </Field>
            <Field label={t('newTransferCash')}>
              <NumberInput
                value={form.newTransferFeesCashThb}
                onChange={(v) => set('newTransferFeesCashThb', v)}
              />
            </Field>
            <Field label={t('newTransferLoan')}>
              <NumberInput
                value={form.newTransferFeesLoanThb}
                onChange={(v) => set('newTransferFeesLoanThb', v)}
              />
            </Field>
            <Field label={t('newLoanOrig')}>
              <NumberInput
                value={form.newLoanOriginationThb}
                onChange={(v) => set('newLoanOriginationThb', v)}
              />
            </Field>
            <Field label={tShared('newReno')}>
              <NumberInput
                value={form.newRenoBudgetThb}
                onChange={(v) => set('newRenoBudgetThb', v)}
              />
            </Field>
          </Section>

          <Section title={tShared('targetsSection')}>
            <Field label={`${t('targetArv')} *`}>
              <NumberInput
                value={form.revisedTargetArvThb}
                onChange={(v) => set('revisedTargetArvThb', v)}
              />
            </Field>
            <Field label={`${tShared('targetTimeline')} *`}>
              <NumberInput
                value={form.revisedTargetTimelineDays}
                onChange={(v) => set('revisedTargetTimelineDays', v)}
              />
            </Field>
          </Section>

          <section className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface p-3 text-sm">
            <h3 className="mb-1 text-sm font-semibold text-text-strong">
              {tShared('summarySection')}
            </h3>
            <Row label={tShared('sunkTotal')}>
              <Currency amount={computed.sunkTotal} />
            </Row>
            <Row label={tShared('newTotal')}>
              <Currency amount={computed.newCapitalTotal} />
            </Row>
            <Row label={tShared('totalCapital')} bold>
              <Currency amount={computed.totalCapitalDeployedThb} />
            </Row>
            <Row label={tShared('projectedProfit')} bold>
              <Currency amount={computed.projectedProfitThb} />
            </Row>
            <Row label={tShared('projectedMargin')}>
              <span className="tabular">{computed.projectedMarginPct.toFixed(1)}%</span>
            </Row>
            <Row label={tShared('projectedRoi')}>
              <span className="tabular">{computed.projectedRoiPct.toFixed(1)}%</span>
            </Row>

            <Compare
              walkAwayLabel={tShared('walkAway')}
              walkAwayAmount={computed.walkAwayLossThb}
              continueLabel={tShared('continuePivot')}
              continueAmount={computed.projectedProfitThb}
            />
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border p-3">
      <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label,
  bold,
  children,
}: {
  label: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-medium text-text-strong' : 'text-text-muted'}>{label}</span>
      <span className={bold ? 'font-medium text-text-strong' : ''}>{children}</span>
    </div>
  );
}

function Compare({
  walkAwayLabel,
  walkAwayAmount,
  continueLabel,
  continueAmount,
}: {
  walkAwayLabel: string;
  walkAwayAmount: number;
  continueLabel: string;
  continueAmount: number;
}) {
  return (
    <div className="mt-3 border-t border-border-subtle pt-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-border p-2">
          <div className="text-xs text-text-muted">{walkAwayLabel}</div>
          <div className="mt-1 text-base font-medium text-destructive">
            <Currency amount={walkAwayAmount} />
          </div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-xs text-text-muted">{continueLabel}</div>
          <div
            className={`mt-1 text-base font-medium ${continueAmount >= 0 ? 'text-positive' : 'text-destructive'}`}
          >
            <Currency amount={continueAmount} />
          </div>
        </div>
      </div>
    </div>
  );
}
