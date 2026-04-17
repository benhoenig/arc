'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDealAnalysis } from '../actions/create-deal-analysis';
import { computeDealFields, dealAnalysisSchema } from '../validators/sourcing-schemas';

type Props = {
  propertyId: string;
  onSuccess?: () => void;
};

function CurrencyField({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">฿</span>
        <Input type="number" className="pl-7 text-right tabular" {...inputProps} />
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
      estPurchasePriceThb: 0,
      estRenovationCostThb: 0,
      estHoldingCostThb: 0,
      estTransactionCostThb: 0,
      estSellingCostThb: 0,
      estArvThb: 0,
      estTimelineDays: 90,
    },
  });

  const watched = useWatch({ control: form.control });
  const computed = computeDealFields({
    estPurchasePriceThb: Number(watched.estPurchasePriceThb) || 0,
    estRenovationCostThb: Number(watched.estRenovationCostThb) || 0,
    estHoldingCostThb: Number(watched.estHoldingCostThb) || 0,
    estTransactionCostThb: Number(watched.estTransactionCostThb) || 0,
    estSellingCostThb: Number(watched.estSellingCostThb) || 0,
    estArvThb: Number(watched.estArvThb) || 0,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        startTransition(async () => {
          // cast: react-hook-form's handleSubmit resolves TFieldValues generically with zod 4;
          // runtime values ARE correctly validated by zodResolver
          const result = await createDealAnalysis(values);
          if (!result.ok) {
            form.setError('root', { message: tErr('server') });
            return;
          }
          form.reset();
          onSuccess?.();
        });
      })}
      className="flex flex-col gap-6"
    >
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-strong">{t('inputs')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyField label={t('purchasePrice')} {...form.register('estPurchasePriceThb')} />
          <CurrencyField label={t('renovationCost')} {...form.register('estRenovationCostThb')} />
          <CurrencyField label={t('holdingCost')} {...form.register('estHoldingCostThb')} />
          <CurrencyField label={t('transactionCost')} {...form.register('estTransactionCostThb')} />
          <CurrencyField label={t('sellingCost')} {...form.register('estSellingCostThb')} />
          <CurrencyField label={t('arv')} {...form.register('estArvThb')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('timeline')}</Label>
          <Input
            type="number"
            className="max-w-[200px] tabular"
            {...form.register('estTimelineDays')}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-text-strong">{t('results')}</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-text-muted">{t('totalCost')}</span>
          <span className="tabular text-right font-medium">{fmt(computed.totalCostThb)}</span>

          <span className="text-text-muted">{t('profit')}</span>
          <span
            className={`tabular text-right font-medium ${computed.estProfitThb >= 0 ? 'text-positive' : 'text-destructive'}`}
          >
            {fmt(computed.estProfitThb)}
          </span>

          <span className="text-text-muted">{t('margin')}</span>
          <span className="tabular text-right font-medium">
            {computed.estMarginPct.toFixed(1)}%
          </span>

          <span className="text-text-muted">{t('roi')}</span>
          <span className="tabular text-right font-medium">{computed.estRoiPct.toFixed(1)}%</span>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="self-end">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
