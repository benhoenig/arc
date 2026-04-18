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

type FlipType = 'float_flip' | 'transfer_in';

type Props = {
  flipId: string;
  flipType: FlipType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: {
    // For float flip, this is the SPA price with the owner (stays fixed unless
    // the team renegotiates). For transfer flips it's not shown.
    originalContractPriceThb?: number;
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
  newRenoBudgetThb: number | undefined;
  newMarketingBudgetThb: number | undefined;
  newCommissionThb: number | undefined;
  newAdditionalDepositThb: number | undefined;
  newAdditionalExpenseThb: number | undefined;
  originalContractPriceThb: number | undefined;
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
    newRenoBudgetThb: undefined,
    newMarketingBudgetThb: undefined,
    newCommissionThb: undefined,
    newAdditionalDepositThb: undefined,
    newAdditionalExpenseThb: undefined,
    originalContractPriceThb: defaults?.originalContractPriceThb,
    revisedTargetArvThb: defaults?.revisedTargetArvThb,
    revisedTargetTimelineDays: defaults?.revisedTargetTimelineDays,
  };
}

/**
 * Re-underwrite a flip without changing its type. Math branches on the
 * current flip type:
 *   - float flip: profit = (new sale price − original contract price) −
 *     total reno − total marketing − commission − other. Collects the
 *     contract-price spread inputs.
 *   - transfer-in: profit = revised ARV − total capital deployed. No
 *     contract-price field; collects standard sunk + additional reno.
 */
export function ReUnderwriteDialog({ flipId, flipType, open, onOpenChange, defaults }: Props) {
  const t = useTranslations('flips.reunderwrite');
  const tShared = useTranslations('flips.revisionShared');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<FormState>(() => initialState(defaults));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mode = flipType === 'float_flip' ? 'float_reunderwrite' : 'transfer_reunderwrite';

  const computed = useMemo(
    () =>
      computeFlipRevisionTotals(mode, {
        sunkDepositThb: form.sunkDepositThb ?? 0,
        sunkRenoSpentThb: form.sunkRenoSpentThb ?? 0,
        sunkMarketingSpentThb: form.sunkMarketingSpentThb ?? 0,
        sunkOtherThb: form.sunkOtherThb ?? 0,
        newRenoBudgetThb: form.newRenoBudgetThb ?? 0,
        newMarketingBudgetThb: form.newMarketingBudgetThb ?? 0,
        newCommissionThb: form.newCommissionThb ?? 0,
        newAdditionalDepositThb: form.newAdditionalDepositThb ?? 0,
        newAdditionalExpenseThb: form.newAdditionalExpenseThb ?? 0,
        originalContractPriceThb: form.originalContractPriceThb ?? 0,
        revisedTargetArvThb: form.revisedTargetArvThb ?? 0,
      }),
    [form, mode],
  );

  const canSubmit =
    (form.revisedTargetArvThb ?? 0) > 0 &&
    (form.revisedTargetTimelineDays ?? 0) > 0 &&
    (flipType !== 'float_flip' || (form.originalContractPriceThb ?? 0) > 0);

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
        revisionType: 'reunderwrite',
        reasonNotes: form.reasonNotes || undefined,
        sunkDepositThb: form.sunkDepositThb ?? 0,
        sunkRenoSpentThb: form.sunkRenoSpentThb ?? 0,
        sunkMarketingSpentThb: form.sunkMarketingSpentThb ?? 0,
        sunkOtherThb: form.sunkOtherThb ?? 0,
        newRenoBudgetThb: form.newRenoBudgetThb ?? 0,
        newMarketingBudgetThb: form.newMarketingBudgetThb ?? 0,
        newCommissionThb: form.newCommissionThb ?? 0,
        newAdditionalDepositThb: form.newAdditionalDepositThb ?? 0,
        newAdditionalExpenseThb: form.newAdditionalExpenseThb ?? 0,
        originalContractPriceThb: form.originalContractPriceThb,
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

  const isFloat = flipType === 'float_flip';

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(isFloat ? 'titleFloat' : 'titleTransfer')}</DialogTitle>
          <DialogDescription>
            {t(isFloat ? 'descriptionFloat' : 'descriptionTransfer')}
          </DialogDescription>
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
            {isFloat ? (
              <Field label={tShared('sunkDeposit')}>
                <NumberInput
                  value={form.sunkDepositThb}
                  onChange={(v) => set('sunkDepositThb', v)}
                />
              </Field>
            ) : null}
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
            <Field label={tShared('newReno')}>
              <NumberInput
                value={form.newRenoBudgetThb}
                onChange={(v) => set('newRenoBudgetThb', v)}
              />
            </Field>
            <Field label={t('newMarketing')}>
              <NumberInput
                value={form.newMarketingBudgetThb}
                onChange={(v) => set('newMarketingBudgetThb', v)}
              />
            </Field>
            <Field label={t('newCommission')}>
              <NumberInput
                value={form.newCommissionThb}
                onChange={(v) => set('newCommissionThb', v)}
              />
            </Field>
            {isFloat ? (
              <>
                <Field label={t('newAdditionalDeposit')} hint={t('newAdditionalDepositHint')}>
                  <NumberInput
                    value={form.newAdditionalDepositThb}
                    onChange={(v) => set('newAdditionalDepositThb', v)}
                  />
                </Field>
                <Field label={t('newAdditionalExpense')} hint={t('newAdditionalExpenseHint')}>
                  <NumberInput
                    value={form.newAdditionalExpenseThb}
                    onChange={(v) => set('newAdditionalExpenseThb', v)}
                  />
                </Field>
              </>
            ) : null}
          </Section>

          <Section title={tShared('targetsSection')}>
            {isFloat ? (
              <Field label={`${t('originalContractPrice')} *`}>
                <NumberInput
                  value={form.originalContractPriceThb}
                  onChange={(v) => set('originalContractPriceThb', v)}
                />
              </Field>
            ) : null}
            <Field label={`${t(isFloat ? 'targetSalePrice' : 'targetArv')} *`}>
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
            {isFloat ? (
              <Row label={t('spread')}>
                <Currency
                  amount={(form.revisedTargetArvThb ?? 0) - (form.originalContractPriceThb ?? 0)}
                />
              </Row>
            ) : null}
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
              <span
                className={computed.projectedProfitThb >= 0 ? 'text-positive' : 'text-destructive'}
              >
                <Currency amount={computed.projectedProfitThb} />
              </span>
            </Row>
            <Row label={tShared('projectedMargin')}>
              <span className="tabular">{computed.projectedMarginPct.toFixed(1)}%</span>
            </Row>
            <Row label={tShared('projectedRoi')}>
              <span className="tabular">{computed.projectedRoiPct.toFixed(1)}%</span>
            </Row>

            <div className="mt-3 border-t border-border-subtle pt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded border border-border p-2">
                  <div className="text-xs text-text-muted">{tShared('walkAway')}</div>
                  <div className="mt-1 text-base font-medium text-destructive">
                    <Currency amount={computed.walkAwayLossThb} />
                  </div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="text-xs text-text-muted">{tShared('continueReunderwrite')}</div>
                  <div
                    className={`mt-1 text-base font-medium ${computed.projectedProfitThb >= 0 ? 'text-positive' : 'text-destructive'}`}
                  >
                    <Currency amount={computed.projectedProfitThb} />
                  </div>
                </div>
              </div>
            </div>
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
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
