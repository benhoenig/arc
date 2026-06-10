'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
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
import {
  cleanNumericInput,
  formatWithCommas,
  parseAmount,
} from '@/features/budget/components/amount-input-helpers';
import type { BudgetCategoryItem } from '@/features/budget/queries/list-budget-categories';
import type { Locale } from '@/lib/i18n';
import { updateAssignment } from '../actions/update-assignment';
import type { AssignmentItem } from '../queries/list-assignments-for-flip';
import type { PaymentModel } from '../validators/contractor-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: AssignmentItem;
  budgetCategories: BudgetCategoryItem[];
};

const NO_CATEGORY = '__none__';

function toInputDate(d: Date | null): string {
  if (!d) {
    return '';
  }
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

// Edit dialog. Pre-fills from the existing assignment. `paymentModel` is
// immutable — the DB CHECK + update-action both reject a change, and mixing
// the two amount shapes under one record is destructive. If operators need
// to switch models, cancel + re-create.
export function EditAssignmentDialog({ open, onOpenChange, assignment, budgetCategories }: Props) {
  const t = useTranslations('contractors');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(assignment.title);
  const [scopeOfWork, setScopeOfWork] = useState(assignment.scopeOfWork ?? '');
  const [startDate, setStartDate] = useState(toInputDate(assignment.startDate));
  const [targetEndDate, setTargetEndDate] = useState(toInputDate(assignment.targetEndDate));
  const [contractAmount, setContractAmount] = useState(
    assignment.contractAmountThb != null ? String(assignment.contractAmountThb) : '',
  );
  const [tmDailyRate, setTmDailyRate] = useState(
    assignment.tmDailyRateThb != null ? String(assignment.tmDailyRateThb) : '',
  );
  const [tmHourlyRate, setTmHourlyRate] = useState(
    assignment.tmHourlyRateThb != null ? String(assignment.tmHourlyRateThb) : '',
  );
  const [tmMarkup, setTmMarkup] = useState(
    assignment.tmMaterialMarkupPct != null ? String(assignment.tmMaterialMarkupPct) : '',
  );
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>(
    assignment.budgetCategoryId ?? NO_CATEGORY,
  );
  const [notes, setNotes] = useState(assignment.notes ?? '');

  // Re-sync when the parent passes a different assignment (dialog reused).
  useEffect(() => {
    setTitle(assignment.title);
    setScopeOfWork(assignment.scopeOfWork ?? '');
    setStartDate(toInputDate(assignment.startDate));
    setTargetEndDate(toInputDate(assignment.targetEndDate));
    setContractAmount(
      assignment.contractAmountThb != null ? String(assignment.contractAmountThb) : '',
    );
    setTmDailyRate(assignment.tmDailyRateThb != null ? String(assignment.tmDailyRateThb) : '');
    setTmHourlyRate(assignment.tmHourlyRateThb != null ? String(assignment.tmHourlyRateThb) : '');
    setTmMarkup(
      assignment.tmMaterialMarkupPct != null ? String(assignment.tmMaterialMarkupPct) : '',
    );
    setBudgetCategoryId(assignment.budgetCategoryId ?? NO_CATEGORY);
    setNotes(assignment.notes ?? '');
    setError(null);
  }, [assignment]);

  const paymentModel = assignment.paymentModel as PaymentModel;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError('validation');
      return;
    }
    setError(null);

    const payload: Parameters<typeof updateAssignment>[0] = {
      id: assignment.id,
      title: title.trim(),
      scopeOfWork: scopeOfWork.trim() || null,
      startDate: startDate || null,
      targetEndDate: targetEndDate || null,
      budgetCategoryId: budgetCategoryId === NO_CATEGORY ? null : budgetCategoryId,
      notes: notes.trim() || null,
    };

    if (paymentModel === 'time_materials') {
      payload.tmDailyRateThb = tmDailyRate ? parseAmount(tmDailyRate) : null;
      payload.tmHourlyRateThb = tmHourlyRate ? parseAmount(tmHourlyRate) : null;
      payload.tmMaterialMarkupPct = tmMarkup ? parseAmount(tmMarkup) : null;
    } else {
      payload.contractAmountThb = parseAmount(contractAmount);
    }

    startTransition(async () => {
      const result = await updateAssignment(payload);
      if (!result.ok) {
        setError(
          result.error === 'conflict' && result.message === 'flip_closed'
            ? t('assignments.flipClosed')
            : result.error === 'conflict'
              ? (result.message ?? 'conflict')
              : result.error,
        );
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('assignments.editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-md border border-border-subtle bg-surface p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-text-muted">
              {t('assignments.columns.contractor')}
            </div>
            <div className="mt-0.5 font-medium text-text-default">
              {assignment.contractor.name} · {t(`paymentModels.${paymentModel}`)}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.title')} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.scopeOfWork')}</Label>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
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

          <div className="flex flex-col gap-1.5">
            <Label>{t('assignments.form.notes')}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
