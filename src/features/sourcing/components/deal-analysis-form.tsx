'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
  useForm,
  useWatch,
} from 'react-hook-form';
import { NumberInput } from '@/components/form/number-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { createDealAnalysis } from '../actions/create-deal-analysis';
import { updateDealAnalysis } from '../actions/update-deal-analysis';
import {
  computeDealFields,
  dealAnalysisSchema,
  type FlipType,
} from '../validators/sourcing-schemas';

type ExistingAnalysis = {
  id: string;
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
};

type Props = {
  propertyId: string;
  /** If provided, form edits this analysis instead of creating new */
  initialAnalysis?: ExistingAnalysis;
  onSuccess?: () => void;
  onCancel?: () => void;
};

function CurrencyField<T extends FieldValues>({
  label,
  name,
  control,
}: {
  label: string;
  name: Path<T>;
  control: Control<T>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-text-muted">
          ฿
        </span>
        <Controller
          name={name}
          control={control}
          render={({ field, fieldState }) => (
            <>
              <NumberInput
                value={field.value as number}
                onChange={(v) => field.onChange(v ?? 0)}
                className={cn('pl-7 text-right', fieldState.error && 'border-destructive')}
              />
              {fieldState.error && (
                <p className="mt-1 text-xs text-destructive">{fieldState.error.message}</p>
              )}
            </>
          )}
        />
      </div>
    </div>
  );
}

export function DealAnalysisForm({ propertyId, initialAnalysis, onSuccess, onCancel }: Props) {
  const isEdit = !!initialAnalysis;
  const router = useRouter();
  const t = useTranslations('sourcing.dealAnalysis');
  const tCommon = useTranslations('sourcing.contacts');
  const tErr = useTranslations('auth.errors');
  const [isPending, setIsPending] = useState(false);

  const form = useForm({
    resolver: zodResolver(dealAnalysisSchema),
    defaultValues: initialAnalysis
      ? {
          propertyId,
          label: initialAnalysis.label ?? '',
          flipType: initialAnalysis.flipType as FlipType,
          estPurchasePriceThb: initialAnalysis.estPurchasePriceThb,
          estRenovationCostThb: initialAnalysis.estRenovationCostThb,
          estSellingCostThb: initialAnalysis.estSellingCostThb,
          estArvThb: initialAnalysis.estArvThb,
          estTimelineDays: initialAnalysis.estTimelineDays,
          estHoldingCostThb: initialAnalysis.estHoldingCostThb,
          estTransactionCostThb: initialAnalysis.estTransactionCostThb,
          depositAmountThb: initialAnalysis.depositAmountThb ?? 0,
          contractMonths: initialAnalysis.contractMonths ?? 3,
          marketingCostThb: initialAnalysis.marketingCostThb,
          otherCostThb: initialAnalysis.otherCostThb,
        }
      : {
          propertyId,
          label: '',
          flipType: 'float_flip' as FlipType,
          estPurchasePriceThb: 0,
          estRenovationCostThb: 0,
          estSellingCostThb: 0,
          estArvThb: 0,
          estTimelineDays: 90,
          estHoldingCostThb: 0,
          estTransactionCostThb: 0,
          depositAmountThb: 0,
          contractMonths: 3,
          marketingCostThb: 0,
          otherCostThb: 0,
        },
  });

  const watched = useWatch({ control: form.control });
  const flipType = (watched.flipType ?? 'float_flip') as FlipType;
  const isFloatFlip = flipType === 'float_flip';

  const computed = computeDealFields({
    flipType,
    estPurchasePriceThb: Number(watched.estPurchasePriceThb) || 0,
    estRenovationCostThb: Number(watched.estRenovationCostThb) || 0,
    estSellingCostThb: Number(watched.estSellingCostThb) || 0,
    estArvThb: Number(watched.estArvThb) || 0,
    estHoldingCostThb: Number(watched.estHoldingCostThb) || 0,
    estTransactionCostThb: Number(watched.estTransactionCostThb) || 0,
    depositAmountThb: Number(watched.depositAmountThb) || 0,
    marketingCostThb: Number(watched.marketingCostThb) || 0,
    otherCostThb: Number(watched.otherCostThb) || 0,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(async (values) => {
          setIsPending(true);
          try {
            const submitted = {
              ...values,
              estTimelineDays:
                values.flipType === 'float_flip'
                  ? (values.contractMonths ?? 3) * 30
                  : values.estTimelineDays,
            };
            const result = isEdit
              ? await updateDealAnalysis({
                  id: initialAnalysis.id,
                  ...submitted,
                } as unknown as Record<string, unknown>)
              : await createDealAnalysis(submitted as unknown as Record<string, unknown>);
            if (!result.ok) {
              if (result.error === 'validation') {
                for (const issue of result.issues) {
                  const field = issue.path[0];
                  if (field) {
                    form.setError(field as never, { message: issue.message });
                  }
                }
              } else {
                form.setError('root', { message: tErr('server') });
              }
              return;
            }
            if (!isEdit) {
              form.reset();
            }
            router.refresh();
            onSuccess?.();
          } finally {
            setIsPending(false);
          }
        })();
      }}
      className="flex flex-col gap-6"
    >
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}

      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('label')}</Label>
        <Input
          placeholder={t('labelPlaceholder')}
          className="max-w-sm"
          {...form.register('label')}
        />
      </div>

      {/* Flip type toggle */}
      <div className="flex gap-1 rounded-md border border-border p-1">
        {(['float_flip', 'transfer_in'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => form.setValue('flipType', type)}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
              flipType === type
                ? 'bg-fill-selected text-text-strong'
                : 'text-text-muted hover:text-text-default',
            )}
          >
            {t(`flipTypes.${type}`)}
          </button>
        ))}
      </div>

      {/* Deal inputs */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-strong">{t('inputs')}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyField
            label={isFloatFlip ? t('spaPrice') : t('purchasePrice')}
            name="estPurchasePriceThb"
            control={form.control}
          />
          <CurrencyField
            label={t('renovationCost')}
            name="estRenovationCostThb"
            control={form.control}
          />

          {isFloatFlip ? (
            <>
              <CurrencyField label={t('deposit')} name="depositAmountThb" control={form.control} />
              <CurrencyField
                label={t('marketingCost')}
                name="marketingCostThb"
                control={form.control}
              />
            </>
          ) : (
            <>
              <CurrencyField
                label={t('holdingCost')}
                name="estHoldingCostThb"
                control={form.control}
              />
              <CurrencyField
                label={t('transactionCost')}
                name="estTransactionCostThb"
                control={form.control}
              />
            </>
          )}

          <CurrencyField label={t('sellingCost')} name="estSellingCostThb" control={form.control} />
          <CurrencyField label={t('otherCost')} name="otherCostThb" control={form.control} />
          <CurrencyField
            label={isFloatFlip ? t('targetSellingPrice') : t('arv')}
            name="estArvThb"
            control={form.control}
          />
        </div>

        {isFloatFlip ? (
          <div className="flex flex-col gap-1.5">
            <Label>{t('contractMonths')}</Label>
            <Controller
              name="contractMonths"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  value={field.value as number}
                  onChange={(v) => field.onChange(v ?? 3)}
                  className="max-w-[200px]"
                />
              )}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>{t('timeline')}</Label>
            <Controller
              name="estTimelineDays"
              control={form.control}
              render={({ field }) => (
                <NumberInput
                  value={field.value as number}
                  onChange={(v) => field.onChange(v ?? 90)}
                  className="max-w-[200px]"
                />
              )}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Results panel */}
      <div className="rounded-md border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-text-strong">{t('results')}</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-text-muted">
            {isFloatFlip ? t('capitalDeployed') : t('totalCost')}
          </span>
          <span className="tabular text-right font-medium">{fmt(computed.totalCostThb)}</span>

          <span className="text-text-muted">{t('profit')}</span>
          <span
            className={cn(
              'tabular text-right font-medium',
              computed.estProfitThb >= 0 ? 'text-positive' : 'text-destructive',
            )}
          >
            {fmt(computed.estProfitThb)}
          </span>

          <span className="text-text-muted">{t('margin')}</span>
          <span className="tabular text-right font-medium">
            {computed.estMarginPct.toFixed(1)}%
          </span>

          <span className="text-text-muted">{t('roi')}</span>
          <span
            className={cn(
              'tabular text-right font-semibold',
              computed.estRoiPct >= 20 ? 'text-positive' : '',
            )}
          >
            {computed.estRoiPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {tCommon('cancel')}
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
