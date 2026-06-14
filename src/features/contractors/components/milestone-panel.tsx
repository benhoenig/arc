'use client';

import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
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
import { createMilestone } from '../actions/create-milestone';
import { deleteMilestone } from '../actions/delete-milestone';
import { requestPayment } from '../actions/request-payment';
import { setMilestoneStatus } from '../actions/set-milestone-status';
import { updateMilestone } from '../actions/update-milestone';
import type { MilestoneItem } from '../queries/list-milestones-for-assignment';
import {
  canTransitionMilestoneStatus,
  type MilestoneStatus,
  milestoneIsBillable,
} from '../validators/payment-schemas';
import { PaymentStatusPill } from './payment-status-pill';

const ALL_STATUSES: MilestoneStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'approved',
  'paid',
  'disputed',
];

type Props = {
  assignmentId: string;
  milestones: MilestoneItem[];
  readOnly?: boolean;
};

export function MilestonePanel({ assignmentId, milestones, readOnly = false }: Props) {
  const t = useTranslations('payments');
  const [editing, setEditing] = useState<MilestoneItem | null>(null);

  return (
    <section className="rounded-lg border border-border-subtle">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('milestones.title')}</h2>
        {!readOnly ? <MilestoneFormDialog assignmentId={assignmentId} mode="create" /> : null}
      </header>

      {milestones.length === 0 ? (
        <EmptyState title={t('milestones.empty')} className="py-8" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">{t('fields.title')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('fields.amount')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.targetDate')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.status')}</th>
              {!readOnly ? <th className="w-40" /> : null}
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <tr key={m.id} className="border-t border-border-subtle">
                <td className="px-4 py-2 text-text-default">{m.title}</td>
                <td className="px-2 py-2 text-right tabular text-text-default">
                  <Currency amount={m.amountThb} />
                </td>
                <td className="px-2 py-2 text-text-muted">
                  {m.targetDate ? <DateDisplay date={m.targetDate} format="short" /> : '—'}
                </td>
                <td className="px-2 py-2">
                  <PaymentStatusPill
                    status={m.status}
                    label={t(`milestones.statuses.${m.status as MilestoneStatus}`)}
                  />
                </td>
                {!readOnly ? (
                  <td className="px-2 py-2">
                    <MilestoneRowActions milestone={m} onEdit={() => setEditing(m)} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing ? (
        <MilestoneFormDialog
          assignmentId={assignmentId}
          mode="edit"
          milestone={editing}
          open
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function MilestoneRowActions({
  milestone,
  onEdit,
}: {
  milestone: MilestoneItem;
  onEdit: () => void;
}) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = milestone.status as MilestoneStatus;
  const canBill = milestoneIsBillable(status) && !milestone.hasActivePayment;
  const canDelete = status !== 'paid' && !milestone.hasActivePayment;

  const options = ALL_STATUSES.filter(
    (s) => s !== 'paid' && (s === status || canTransitionMilestoneStatus(status, s)),
  );

  function changeStatus(next: MilestoneStatus) {
    if (next === status) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await setMilestoneStatus({ id: milestone.id, status: next });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  function bill() {
    setError(null);
    startTransition(async () => {
      const r = await requestPayment({ source: 'milestone', milestoneId: milestone.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  function remove() {
    if (!confirm(t('milestones.confirmDelete'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await deleteMilestone({ id: milestone.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error ? <span className="mr-1 text-xs text-destructive">{t(`errors.${error}`)}</span> : null}
      <Select
        value={status}
        onValueChange={(v) => changeStatus(v as MilestoneStatus)}
        disabled={isPending || options.length <= 1}
      >
        <SelectTrigger className="h-7 w-auto min-w-[100px] border-0 bg-transparent px-2 text-xs shadow-none hover:bg-fill-hover">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`milestones.statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canBill ? (
        <button
          type="button"
          onClick={bill}
          disabled={isPending}
          className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default"
          title={t('milestones.requestPayment')}
          aria-label={t('milestones.requestPayment')}
        >
          <Wallet size={14} strokeWidth={1.5} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        disabled={isPending || status === 'paid'}
        className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default disabled:opacity-30"
        title={tCommon('edit')}
        aria-label={tCommon('edit')}
      >
        <Pencil size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={isPending || !canDelete}
        className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-30"
        title={tCommon('delete')}
        aria-label={tCommon('delete')}
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function MilestoneFormDialog({
  assignmentId,
  mode,
  milestone,
  open: controlledOpen,
  onOpenChange,
}: {
  assignmentId: string;
  mode: 'create' | 'edit';
  milestone?: MilestoneItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [title, setTitle] = useState(milestone?.title ?? '');
  const [amount, setAmount] = useState(milestone ? String(milestone.amountThb) : '0');
  const [targetDate, setTargetDate] = useState(
    milestone?.targetDate ? new Date(milestone.targetDate).toISOString().slice(0, 10) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseAmount(amount);
    if (title.trim().length === 0 || !(amt >= 0)) {
      setError('validation');
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        title: title.trim(),
        amountThb: amt,
        targetDate: targetDate || undefined,
      };
      const r =
        mode === 'create'
          ? await createMilestone({ assignmentId, ...payload })
          : await updateMilestone({ id: milestone?.id ?? '', ...payload });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === 'create' ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus size={14} strokeWidth={1.5} className="mr-1" />
            {t('milestones.add')}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('milestones.addTitle') : t('milestones.editTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('fields.title')} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('fields.amount')} (THB) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formatWithCommas(amount)}
                onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
                className="tabular text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('fields.targetDate')}</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{t(`errors.${error}`)}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === 'create' ? tCommon('add') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
