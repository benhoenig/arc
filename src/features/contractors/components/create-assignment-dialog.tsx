'use client';

import { AlertTriangle, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  cleanNumericInput,
  formatWithCommas,
  parseAmount,
} from '@/features/budget/components/amount-input-helpers';
import type { BudgetCategoryItem } from '@/features/budget/queries/list-budget-categories';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n';
import { type ConflictAssignment, checkConflicts } from '../actions/check-conflicts';
import { createAssignment } from '../actions/create-assignment';
import type { ContractorListItem } from '../queries/list-contractors';
import { PAYMENT_MODELS, type PaymentModel } from '../validators/contractor-schemas';

type Props = {
  flipId: string;
  contractors: ContractorListItem[];
  budgetCategories: BudgetCategoryItem[];
  disabled?: boolean;
};

const NO_CATEGORY = '__none__';

export function CreateAssignmentDialog({ flipId, contractors, budgetCategories, disabled }: Props) {
  const t = useTranslations('contractors');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictAssignment[]>([]);
  const [overrideConflict, setOverrideConflict] = useState(false);

  const [contractorId, setContractorId] = useState<string>(contractors[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [paymentModel, setPaymentModel] = useState<PaymentModel>('fixed_milestone');
  const [contractAmount, setContractAmount] = useState('0');
  const [tmDailyRate, setTmDailyRate] = useState('');
  const [tmHourlyRate, setTmHourlyRate] = useState('');
  const [tmMarkup, setTmMarkup] = useState('');
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>(NO_CATEGORY);
  const [notes, setNotes] = useState('');

  function reset() {
    setContractorId(contractors[0]?.id ?? '');
    setTitle('');
    setScopeOfWork('');
    setStartDate('');
    setTargetEndDate('');
    setPaymentModel('fixed_milestone');
    setContractAmount('0');
    setTmDailyRate('');
    setTmHourlyRate('');
    setTmMarkup('');
    setBudgetCategoryId(NO_CATEGORY);
    setNotes('');
    setError(null);
    setConflicts([]);
    setOverrideConflict(false);
  }

  // Recompute conflicts when contractor or dates change.
  useEffect(() => {
    if (!open || !contractorId) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await checkConflicts({
        contractorId,
        startDate: startDate || null,
        targetEndDate: targetEndDate || null,
      });
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setConflicts(result.data.conflicts);
        setOverrideConflict(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contractorId, startDate, targetEndDate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractorId || title.trim().length === 0) {
      setError('validation');
      return;
    }
    if (conflicts.length > 0 && !overrideConflict) {
      return;
    }
    setError(null);

    const base = {
      flipId,
      contractorId,
      title: title.trim(),
      scopeOfWork: scopeOfWork.trim() || undefined,
      startDate: startDate || undefined,
      targetEndDate: targetEndDate || undefined,
      budgetCategoryId: budgetCategoryId === NO_CATEGORY ? undefined : budgetCategoryId,
      notes: notes.trim() || undefined,
    };

    const payload =
      paymentModel === 'time_materials'
        ? {
            ...base,
            paymentModel: 'time_materials' as const,
            tmDailyRateThb: tmDailyRate ? parseAmount(tmDailyRate) : undefined,
            tmHourlyRateThb: tmHourlyRate ? parseAmount(tmHourlyRate) : undefined,
            tmMaterialMarkupPct: tmMarkup ? parseAmount(tmMarkup) : undefined,
          }
        : {
            ...base,
            paymentModel,
            contractAmountThb: parseAmount(contractAmount),
          };

    startTransition(async () => {
      const result = await createAssignment(payload);
      if (!result.ok) {
        setError(
          result.error === 'conflict' && result.message === 'flip_closed'
            ? 'flip_closed'
            : result.error,
        );
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled || contractors.length === 0}>
        <Button size="sm" variant="outline" disabled={disabled || contractors.length === 0}>
          <Plus size={14} strokeWidth={1.5} className="mr-1" />
          {t('assignments.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('assignments.addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('assignments.form.contractor')} *</Label>
              <Select value={contractorId} onValueChange={setContractorId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('assignments.form.paymentModel')} *</Label>
              <Select
                value={paymentModel}
                onValueChange={(v) => setPaymentModel(v as PaymentModel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`paymentModels.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-muted">{t(`paymentModelHints.${paymentModel}`)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.title')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('assignments.form.titlePlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.scopeOfWork')}</Label>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder={t('assignments.form.scopeOfWorkPlaceholder')}
              rows={3}
              className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-text-default outline-none focus:border-border-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('assignments.form.startDate')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('assignments.form.targetEndDate')}</Label>
              <Input
                type="date"
                value={targetEndDate}
                min={startDate || undefined}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>
          </div>

          {paymentModel === 'time_materials' ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('assignments.form.tmDailyRate')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatWithCommas(tmDailyRate)}
                  onChange={(e) => setTmDailyRate(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('assignments.form.tmHourlyRate')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatWithCommas(tmHourlyRate)}
                  onChange={(e) => setTmHourlyRate(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('assignments.form.tmMaterialMarkup')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={tmMarkup}
                  onChange={(e) => setTmMarkup(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>{t('assignments.form.contractAmount')} *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formatWithCommas(contractAmount)}
                onChange={(e) => setContractAmount(cleanNumericInput(e.target.value))}
                className="tabular text-right"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.budgetCategory')}</Label>
            <Select value={budgetCategoryId} onValueChange={setBudgetCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{t('assignments.form.noCategory')}</SelectItem>
                {budgetCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {locale === 'en' && cat.nameEn ? cat.nameEn : cat.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {conflicts.length > 0 ? (
            <div className="rounded-md border border-warning bg-warning-fill p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <div className="flex flex-col gap-2 text-sm text-text-default">
                  <span className="font-medium">{t('conflicts.title')}</span>
                  <span>{t('conflicts.description', { count: conflicts.length })}</span>
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {conflicts.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/flips/${c.flip.id}`}
                          className="text-text-muted hover:underline"
                        >
                          {c.flip.code} — {c.title}
                        </Link>
                        {c.startDate
                          ? ` · ${new Date(c.startDate).toISOString().slice(0, 10)}`
                          : ''}
                        {c.targetEndDate
                          ? ` → ${new Date(c.targetEndDate).toISOString().slice(0, 10)}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-1 inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={overrideConflict}
                      onChange={(e) => setOverrideConflict(e.target.checked)}
                    />
                    {t('conflicts.proceedAnyway')}
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending || (conflicts.length > 0 && !overrideConflict)}
            >
              {tCommon('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
