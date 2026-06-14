'use client';

import { upload } from '@vercel/blob/client';
import { Check, Plus, Trash2, Upload, Wallet, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
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
import { buildReceiptPath } from '@/lib/blob-paths';
import { createTmEntry } from '../actions/create-tm-entry';
import { deleteTmEntry } from '../actions/delete-tm-entry';
import { requestPayment } from '../actions/request-payment';
import { setTmEntryStatus } from '../actions/set-tm-entry-status';
import type { TmEntryItem } from '../queries/list-tm-entries-for-assignment';
import type { TmEntryStatus, TmEntryType } from '../validators/payment-schemas';
import { PaymentStatusPill } from './payment-status-pill';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

type Props = {
  assignmentId: string;
  flipId: string;
  orgId: string;
  entries: TmEntryItem[];
  defaultMarkupPct?: number | null;
  readOnly?: boolean;
};

export function TmEntryPanel({
  assignmentId,
  flipId,
  orgId,
  entries,
  defaultMarkupPct,
  readOnly = false,
}: Props) {
  const t = useTranslations('payments');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const approvedTotal = entries
    .filter((e) => e.status === 'approved')
    .reduce((s, e) => s + e.lineTotalThb, 0);
  const canBatch = approvedTotal > 0 && !readOnly;

  function requestBatch() {
    setError(null);
    startTransition(async () => {
      const r = await requestPayment({ source: 'tm_batch', assignmentId });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-border-subtle">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('tm.title')}</h2>
        <div className="flex items-center gap-2">
          {canBatch ? (
            <Button size="sm" variant="outline" onClick={requestBatch} disabled={isPending}>
              <Wallet size={14} strokeWidth={1.5} className="mr-1" />
              {t('tm.requestApproved')} (<Currency amount={approvedTotal} />)
            </Button>
          ) : null}
          {!readOnly ? (
            <AddTmEntryDialog
              assignmentId={assignmentId}
              flipId={flipId}
              orgId={orgId}
              defaultMarkupPct={defaultMarkupPct}
            />
          ) : null}
        </div>
      </header>

      {error ? <p className="px-4 py-2 text-sm text-destructive">{t(`errors.${error}`)}</p> : null}

      {entries.length === 0 ? (
        <EmptyState title={t('tm.empty')} className="py-8" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">{t('fields.date')}</th>
              <th className="px-2 py-2 font-medium">{t('tm.type')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.description')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('tm.lineTotal')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.status')}</th>
              {!readOnly ? <th className="w-28" /> : null}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border-subtle">
                <td className="px-4 py-2 text-text-muted">
                  <DateDisplay date={e.entryDate} format="short" />
                </td>
                <td className="px-2 py-2 text-text-muted">
                  {t(`tm.types.${e.entryType as TmEntryType}`)}
                </td>
                <td className="px-2 py-2 text-text-default">{e.description}</td>
                <td className="px-2 py-2 text-right tabular text-text-default">
                  <Currency amount={e.lineTotalThb} />
                </td>
                <td className="px-2 py-2">
                  <PaymentStatusPill
                    status={e.status}
                    label={t(`tm.statuses.${e.status as TmEntryStatus}`)}
                  />
                </td>
                {!readOnly ? (
                  <td className="px-2 py-2">
                    <TmRowActions entry={e} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TmRowActions({ entry }: { entry: TmEntryItem }) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = entry.status as TmEntryStatus;
  const canApprove = status === 'pending';
  const canReject = status === 'pending' || status === 'approved';
  const canDelete = status !== 'paid';

  function setStatus(next: TmEntryStatus) {
    setError(null);
    startTransition(async () => {
      const r = await setTmEntryStatus({ id: entry.id, status: next });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  function remove() {
    if (!confirm(t('tm.confirmDelete'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await deleteTmEntry({ id: entry.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error ? <span className="mr-1 text-xs text-destructive">{t(`errors.${error}`)}</span> : null}
      {canApprove ? (
        <button
          type="button"
          onClick={() => setStatus('approved')}
          disabled={isPending}
          className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-positive"
          title={t('tm.approve')}
          aria-label={t('tm.approve')}
        >
          <Check size={14} strokeWidth={1.5} />
        </button>
      ) : null}
      {canReject ? (
        <button
          type="button"
          onClick={() => setStatus('rejected')}
          disabled={isPending}
          className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive"
          title={t('tm.reject')}
          aria-label={t('tm.reject')}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      ) : null}
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

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function AddTmEntryDialog({
  assignmentId,
  flipId,
  orgId,
  defaultMarkupPct,
}: {
  assignmentId: string;
  flipId: string;
  orgId: string;
  defaultMarkupPct?: number | null;
}) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<TmEntryType>('labor');
  const [date, setDate] = useState(isoToday());
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState('0');
  const [days, setDays] = useState('1');
  const [cost, setCost] = useState('0');
  const [markup, setMarkup] = useState(defaultMarkupPct != null ? String(defaultMarkupPct) : '0');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEntryType('labor');
    setDate(isoToday());
    setDescription('');
    setRate('0');
    setDays('1');
    setCost('0');
    setMarkup(defaultMarkupPct != null ? String(defaultMarkupPct) : '0');
    setReceiptFile(null);
    setError(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('uploadInvalidType');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setError('uploadTooLarge');
      e.target.value = '';
      return;
    }
    setReceiptFile(file);
  }

  async function uploadReceipt(): Promise<string | null> {
    if (!receiptFile) {
      return null;
    }
    const ext = receiptFile.name.split('.').pop() || 'bin';
    const path = buildReceiptPath(orgId, flipId, ext);
    const result = await upload(path, receiptFile, {
      access: 'private',
      contentType: receiptFile.type,
      handleUploadUrl: '/api/blob/upload',
      clientPayload: JSON.stringify({ kind: 'receipt' }),
    });
    return result.pathname;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length === 0) {
      setError('validation');
      return;
    }
    const isLabor = entryType === 'labor';
    if (isLabor && !(parseAmount(rate) > 0 && parseAmount(days) > 0)) {
      setError('validation');
      return;
    }
    if (!isLabor && !(parseAmount(cost) > 0)) {
      setError('validation');
      return;
    }
    setError(null);
    startTransition(async () => {
      let receiptPath: string | null = null;
      try {
        receiptPath = await uploadReceipt();
      } catch {
        setError('uploadFailed');
        return;
      }
      const r = isLabor
        ? await createTmEntry({
            assignmentId,
            entryType: 'labor',
            entryDate: date,
            description: description.trim(),
            appliedRateThb: parseAmount(rate),
            daysWorked: parseAmount(days),
          })
        : await createTmEntry({
            assignmentId,
            entryType: 'material',
            entryDate: date,
            description: description.trim(),
            materialCostThb: parseAmount(cost),
            materialMarkupPct: parseAmount(markup),
            receiptPath,
          });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  const isLabor = entryType === 'labor';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus size={14} strokeWidth={1.5} className="mr-1" />
          {t('tm.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tm.addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('tm.type')} *</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as TmEntryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">{t('tm.types.labor')}</SelectItem>
                  <SelectItem value="material">{t('tm.types.material')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('fields.date')} *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('fields.description')} *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {isLabor ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('tm.rate')} (THB) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatWithCommas(rate)}
                  onChange={(e) => setRate(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('tm.days')} *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatWithCommas(days)}
                  onChange={(e) => setDays(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('tm.materialCost')} (THB) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatWithCommas(cost)}
                  onChange={(e) => setCost(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('tm.markup')} (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={markup}
                  onChange={(e) => setMarkup(cleanNumericInput(e.target.value))}
                  className="tabular text-right"
                />
              </div>
            </div>
          )}

          {!isLabor ? (
            <div className="flex flex-col gap-1.5">
              <Label>{t('tm.receipt')}</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} strokeWidth={1.5} className="mr-1" />
                  {receiptFile ? t('tm.changeReceipt') : t('tm.uploadReceipt')}
                </Button>
                {receiptFile ? (
                  <span className="truncate text-xs text-text-muted">{receiptFile.name}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{t(`errors.${error}`)}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {tCommon('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
