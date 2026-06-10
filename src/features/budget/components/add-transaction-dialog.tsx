'use client';

import { upload } from '@vercel/blob/client';
import { Plus, Upload, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
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
import { buildReceiptPath } from '@/lib/blob-paths';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { createFlipTransaction } from '../actions/create-flip-transaction';
import type { BudgetLineItem } from '../queries/list-budget-lines';
import { TRANSACTION_KINDS, type TransactionKind } from '../validators/transaction-schemas';
import { cleanNumericInput, formatWithCommas, parseAmount } from './amount-input-helpers';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

type Props = {
  flipId: string;
  orgId: string;
  budgetLines: BudgetLineItem[];
  defaultKind?: TransactionKind;
  defaultBudgetLineId?: string;
  trigger?: React.ReactNode;
  disabled?: boolean;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionDialog({
  flipId,
  orgId,
  budgetLines,
  defaultKind = 'spend',
  defaultBudgetLineId,
  trigger,
  disabled,
}: Props) {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TransactionKind>(defaultKind);
  const [amount, setAmount] = useState('0');
  const [date, setDate] = useState<string>(isoToday());
  const [description, setDescription] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [budgetLineId, setBudgetLineId] = useState<string>(
    defaultBudgetLineId ?? budgetLines[0]?.id ?? '',
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsBudgetLine = kind === 'spend' || kind === 'refund';
  const needsSourceNote = kind === 'investor_deposit' || kind === 'loan_disbursement';

  function reset() {
    setKind(defaultKind);
    setAmount('0');
    setDate(isoToday());
    setDescription('');
    setSourceNote('');
    setBudgetLineId(defaultBudgetLineId ?? budgetLines[0]?.id ?? '');
    setReceiptFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('transactions.uploadInvalidType'));
      e.target.value = '';
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setError(t('transactions.uploadTooLarge'));
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = parseAmount(amount);
    if (!(parsed > 0)) {
      setError('validation');
      return;
    }
    if (description.trim().length === 0) {
      setError('validation');
      return;
    }
    if (needsBudgetLine && !budgetLineId) {
      setError('validation');
      return;
    }
    if (needsSourceNote && sourceNote.trim().length === 0) {
      setError('validation');
      return;
    }

    setError(null);
    startTransition(async () => {
      let uploadedPath: string | null = null;
      try {
        uploadedPath = await uploadReceipt();
      } catch {
        setError(t('transactions.uploadFailed'));
        return;
      }

      const base = {
        flipId,
        amountThb: parsed,
        date,
        description: description.trim(),
        receiptPath: uploadedPath,
      } as const;

      const payload =
        kind === 'spend' || kind === 'refund'
          ? { ...base, kind, budgetLineId, sourceNote: sourceNote.trim() || undefined }
          : { ...base, kind, sourceNote: sourceNote.trim() };

      const result = await createFlipTransaction(payload);
      if (!result.ok) {
        setError(
          result.error === 'conflict'
            ? result.message === 'flip_closed'
              ? t('transactions.flipClosed')
              : (result.message ?? 'conflict')
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
      <DialogTrigger asChild disabled={disabled}>
        {trigger ?? (
          <Button size="sm" variant="outline" disabled={disabled}>
            <Plus size={14} strokeWidth={1.5} className="mr-1" />
            {t('actions.addTransaction')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('transactions.addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('transactions.kind')} *</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as TransactionKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`transactions.kinds.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsBudgetLine ? (
            <div className="flex flex-col gap-1.5">
              <Label>{t('transactions.chooseBudgetLine')} *</Label>
              <Select value={budgetLineId} onValueChange={setBudgetLineId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {budgetLines.map((line) => {
                    const catLabel =
                      locale === 'en' && line.category.nameEn
                        ? line.category.nameEn
                        : line.category.nameTh;
                    return (
                      <SelectItem key={line.id} value={line.id}>
                        {catLabel} — {line.description}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('transactions.amount')} (THB) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formatWithCommas(amount)}
                onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
                placeholder={t('transactions.amountPlaceholder')}
                className="tabular text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('transactions.date')} *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('transactions.description')} *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('transactions.descriptionPlaceholder')}
            />
          </div>

          {needsSourceNote || kind === 'sale_proceeds' || kind === 'distribution' ? (
            <div className="flex flex-col gap-1.5">
              <Label>
                {t('transactions.source')}
                {needsSourceNote ? ' *' : ''}
              </Label>
              <Input
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder={t('transactions.sourcePlaceholder')}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>{t('transactions.receipt')}</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} strokeWidth={1.5} className="mr-1" />
                {receiptFile ? t('transactions.changeReceipt') : t('transactions.uploadReceipt')}
              </Button>
              {receiptFile ? (
                <div className="flex min-w-0 items-center gap-1 text-xs text-text-muted">
                  <span className={cn('truncate')}>{receiptFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-text-muted hover:text-destructive"
                    aria-label={t('transactions.removeReceipt')}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
