'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { createDealAnalysis } from '../actions/create-deal-analysis';
import {
  computeDealFields,
  dealAnalysisSchema,
  type FlipType,
} from '../validators/sourcing-schemas';

type Props = {
  propertyId: string;
  onSuccess?: () => void;
};

function CurrencyInput({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">฿</span>
        <Input type="number" className="pl-7 text-right tabular" {...props} />
      </div>
    </div>
  );
}

export function DealAnalysisForm({ propertyId, onSuccess }: Props) {
  const t = useTranslations('sourcing.dealAnalysis');
  const tErr = useTranslations('auth.errors');
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(dealAnalysisSchema),
    defaultValues: {
      propertyId,
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
        form.handleSubmit((values) => {
          startTransition(async () => {
            // For float flip: derive timeline days from contract months
            const submitted = {
              ...values,
              estTimelineDays:
                values.flipType === 'float_flip'
                  ? (values.contractMonths ?? 3) * 30
                  : values.estTimelineDays,
            };
            const result = await createDealAnalysis(
              submitted as unknown as Record<string, unknown>,
            );
            if (!result.ok) {
              form.setError('root', { message: tErr('server') });
              return;
            }
            form.reset();
            onSuccess?.();
          });
        })();
      }}
      className="flex flex-col gap-6"
    >
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}

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
          <CurrencyInput
            label={isFloatFlip ? t('spaPrice') : t('purchasePrice')}
            {...form.register('estPurchasePriceThb', { valueAsNumber: true })}
          />
          <CurrencyInput
            label={t('renovationCost')}
            {...form.register('estRenovationCostThb', { valueAsNumber: true })}
          />

          {isFloatFlip ? (
            <>
              <CurrencyInput
                label={t('deposit')}
                {...form.register('depositAmountThb', { valueAsNumber: true })}
              />
              <CurrencyInput
                label={t('marketingCost')}
                {...form.register('marketingCostThb', { valueAsNumber: true })}
              />
            </>
          ) : (
            <>
              <CurrencyInput
                label={t('holdingCost')}
                {...form.register('estHoldingCostThb', { valueAsNumber: true })}
              />
              <CurrencyInput
                label={t('transactionCost')}
                {...form.register('estTransactionCostThb', { valueAsNumber: true })}
              />
            </>
          )}

          <CurrencyInput
            label={t('sellingCost')}
            {...form.register('estSellingCostThb', { valueAsNumber: true })}
          />
          <CurrencyInput
            label={isFloatFlip ? t('targetSellingPrice') : t('arv')}
            {...form.register('estArvThb', { valueAsNumber: true })}
          />
        </div>

        {isFloatFlip ? (
          <div className="flex flex-col gap-1.5">
            <Label>{t('contractMonths')}</Label>
            <Input
              type="number"
              className="max-w-[200px] tabular"
              {...form.register('contractMonths', { valueAsNumber: true })}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>{t('timeline')}</Label>
            <Input
              type="number"
              className="max-w-[200px] tabular"
              {...form.register('estTimelineDays', { valueAsNumber: true })}
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

      <Button type="submit" disabled={isPending} className="self-end">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
