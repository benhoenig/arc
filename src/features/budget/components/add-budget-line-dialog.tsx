'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
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
import { createBudgetCategoryInline } from '../actions/create-budget-category-inline';
import { createBudgetLine } from '../actions/create-budget-line';
import type { BudgetCategoryItem } from '../queries/list-budget-categories';
import { cleanNumericInput, formatWithCommas, parseAmount } from './amount-input-helpers';

type Props = {
  flipId: string;
  categories: BudgetCategoryItem[];
  /** Admins may create a new category inline; non-admins only pick existing. */
  canCreateCategory?: boolean;
  disabled?: boolean;
};

export function AddBudgetLineDialog({
  flipId,
  categories,
  canCreateCategory = false,
  disabled,
}: Props) {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [budgeted, setBudgeted] = useState('0');
  const [committed, setCommitted] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Categories created inline this session, merged with the server-provided
  // list so a freshly-added category is immediately selectable (the server prop
  // catches up after router.refresh()).
  const [createdCats, setCreatedCats] = useState<BudgetCategoryItem[]>([]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newNameTh, setNewNameTh] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCreatingCat, startCatTransition] = useTransition();

  const allCategories = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    const merged = [...categories, ...createdCats.filter((c) => !ids.has(c.id))];
    return merged.sort((a, b) => a.sortOrder - b.sortOrder || a.nameTh.localeCompare(b.nameTh));
  }, [categories, createdCats]);

  function startCreateCategory() {
    setNewNameTh('');
    setNewNameEn('');
    setCategoryError(null);
    setCreatingCategory(true);
  }

  function cancelCreateCategory() {
    setCreatingCategory(false);
    setCategoryError(null);
  }

  function submitCreateCategory() {
    const nameTh = newNameTh.trim();
    if (nameTh.length === 0) {
      return;
    }
    setCategoryError(null);
    startCatTransition(async () => {
      const result = await createBudgetCategoryInline({
        nameTh,
        nameEn: newNameEn.trim() === '' ? undefined : newNameEn.trim(),
      });
      if (!result.ok) {
        setCategoryError(
          result.error === 'forbidden'
            ? t('categories.forbidden')
            : result.error === 'conflict'
              ? (result.message ?? 'conflict')
              : result.error,
        );
        return;
      }
      setCreatedCats((prev) => [...prev, result.data]);
      setCategoryId(result.data.id);
      setCreatingCategory(false);
      router.refresh();
    });
  }

  function reset() {
    setDescription('');
    setBudgeted('0');
    setCommitted('0');
    setError(null);
    setCreatingCategory(false);
    setCategoryError(null);
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
        disabled={disabled || (categories.length === 0 && !canCreateCategory)}
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
              <div className="flex items-center justify-between">
                <Label>{t('line.category')} *</Label>
                {canCreateCategory && !creatingCategory ? (
                  <button
                    type="button"
                    onClick={startCreateCategory}
                    className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-default"
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    {t('actions.newCategory')}
                  </button>
                ) : null}
              </div>
              {creatingCategory ? (
                <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface p-3">
                  <Input
                    value={newNameTh}
                    onChange={(e) => setNewNameTh(e.target.value)}
                    placeholder={t('line.newCategoryNameTh')}
                    aria-label={t('line.newCategoryNameTh')}
                    autoFocus
                  />
                  <Input
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                    placeholder={t('line.newCategoryNameEn')}
                    aria-label={t('line.newCategoryNameEn')}
                  />
                  {categoryError ? (
                    <p className="text-xs text-destructive">{categoryError}</p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={cancelCreateCategory}>
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitCreateCategory}
                      disabled={isCreatingCat || newNameTh.trim().length === 0}
                    >
                      {tCommon('add')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((c) => {
                      const label = locale === 'en' && c.nameEn ? c.nameEn : c.nameTh;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
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
                disabled={
                  isPending || creatingCategory || !categoryId || description.trim().length === 0
                }
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
