'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Locale } from '@/lib/i18n';
import { createBudgetLine } from '../actions/create-budget-line';
import type { BudgetCategoryItem } from '../queries/list-budget-categories';
import { cleanNumericInput, formatWithCommas, parseAmount } from './amount-input-helpers';

type Props = {
  flipId: string;
  categories: BudgetCategoryItem[];
  disabled?: boolean;
};

export function AddBudgetLineDialog({ flipId, categories, disabled }: Props) {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [budgeted, setBudgeted] = useState('0');
  const [committed, setCommitted] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setDescription('');
    setBudgeted('0');
    setCommitted('0');
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || description.trim().length === 0) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBudgetLine({
        flipId,
        categoryId,
        description: description.trim(),
        budgetedAmountThb: parseAmount(budgeted),
        committedAmountThb: parseAmount(committed),
      });
      if (!result.ok) {
        setError(
          result.error === 'validation'
            ? 'validation'
            : result.error === 'conflict'
              ? (result.message ?? 'conflict')
              : result.error,
        );
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled || categories.length === 0}
      >
        <Plus size={14} strokeWidth={1.5} className="mr-1" />
        {t('actions.addLine')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('actions.addLine')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t('line.category')} *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => {
                    const label = locale === 'en' && c.nameEn ? c.nameEn : c.nameTh;
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('line.description')} *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('line.descriptionPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AmountField label={t('line.budgeted')} value={budgeted} onChange={setBudgeted} />
              <AmountField label={t('line.committed')} value={committed} onChange={setCommitted} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isPending || !categoryId || description.trim().length === 0}
              >
                {tCommon('add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        value={formatWithCommas(value)}
        onChange={(e) => onChange(cleanNumericInput(e.target.value))}
        className="tabular text-right"
      />
    </div>
  );
}
