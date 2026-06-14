'use client';

import { upload } from '@vercel/blob/client';
import { Sparkles, Trash2, Upload } from 'lucide-react';
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
import {
  cleanNumericInput,
  formatWithCommas,
  parseAmount,
} from '@/features/budget/components/amount-input-helpers';
import { buildOcrDocPath, buildReceiptPath, RECEIPT_CONTENT_TYPES } from '@/lib/blob-paths';
import type { Locale } from '@/lib/i18n';
import {
  bulkCreateBudgetLines,
  bulkCreateMilestones,
  bulkCreateTmEntries,
  bulkCreateTransactions,
  createContractorFromExtraction,
} from '../actions/bulk-create';
import { extractFromDocument } from '../actions/extract-document';
import {
  type ExtractionMode,
  type ExtractionTarget,
  TARGET_CONFIG,
} from '../validators/extraction-schemas';

const MAX_BYTES = 10 * 1024 * 1024;

type CategoryOption = { id: string; nameTh: string; nameEn: string | null };
type BudgetLineOption = { id: string; description: string; category: CategoryOption };

type Props = {
  orgId: string;
  allowedTargets: ExtractionTarget[];
  flipId?: string;
  assignmentId?: string;
  budgetLines?: BudgetLineOption[];
  budgetCategories?: CategoryOption[];
  triggerLabel?: string;
};

// One broad editable row; only the fields relevant to the active target are used.
type EditRow = {
  key: string;
  include: boolean;
  description: string;
  title: string;
  amount: string;
  date: string;
  budgetLineId: string;
  categoryId: string;
  entryType: 'labor' | 'material';
  name: string;
  phone: string;
  taxId: string;
  address: string;
  contactPerson: string;
  email: string;
};

function blankRow(): EditRow {
  return {
    key: crypto.randomUUID(),
    include: true,
    description: '',
    title: '',
    amount: '0',
    date: '',
    budgetLineId: '',
    categoryId: '',
    entryType: 'labor',
    name: '',
    phone: '',
    taxId: '',
    address: '',
    contactPerson: '',
    email: '',
  };
}

export function ExtractDialog({
  orgId,
  allowedTargets,
  flipId,
  assignmentId,
  budgetLines = [],
  budgetCategories = [],
  triggerLabel,
}: Props) {
  const t = useTranslations('ocr');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'configure' | 'review'>('configure');
  const [target, setTarget] = useState<ExtractionTarget>(allowedTargets[0] ?? 'transaction');
  const [mode, setMode] = useState<ExtractionMode>('single');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const catLabel = (c: CategoryOption) => (locale === 'en' && c.nameEn ? c.nameEn : c.nameTh);

  // Always resolve an error code to a readable message — fall back to the
  // generic server message so an unmapped code never renders blank (or trips
  // next-intl's MISSING_MESSAGE) in front of the user.
  const errorMessage = error
    ? t.has(`errors.${error}`)
      ? t(`errors.${error}`)
      : t('errors.server')
    : null;

  function reset() {
    setStep('configure');
    setTarget(allowedTargets[0] ?? 'transaction');
    setMode('single');
    setFile(null);
    setRows([]);
    setError(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && !RECEIPT_CONTENT_TYPES.includes(f.type)) {
      setError('uploadInvalidType');
      e.target.value = '';
      return;
    }
    if (f && f.size > MAX_BYTES) {
      setError('uploadTooLarge');
      e.target.value = '';
      return;
    }
    setFile(f);
  }

  function runExtract() {
    if (!file) {
      setError('noFile');
      return;
    }
    setError(null);
    startTransition(async () => {
      const ext = file.name.split('.').pop() || 'bin';
      const path = flipId ? buildReceiptPath(orgId, flipId, ext) : buildOcrDocPath(orgId, ext);
      let pathname: string;
      try {
        const res = await upload(path, file, {
          access: 'private',
          contentType: file.type,
          handleUploadUrl: '/api/blob/upload',
          clientPayload: JSON.stringify({ kind: 'receipt' }),
        });
        pathname = res.pathname;
      } catch {
        setError('uploadFailed');
        return;
      }

      const result = await extractFromDocument({ target, mode, blobPathname: pathname });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        return;
      }
      setRows(result.data.items.map(toEditRow));
      if (result.data.items.length === 0) {
        setError('noItems');
        return;
      }
      setStep('review');
    });
  }

  function toEditRow(item: Record<string, unknown>): EditRow {
    const r = blankRow();
    if (typeof item.description === 'string') {
      r.description = item.description;
    }
    if (typeof item.title === 'string') {
      r.title = item.title;
    }
    if (typeof item.name === 'string') {
      r.name = item.name;
    }
    if (typeof item.amountThb === 'number') {
      r.amount = String(item.amountThb);
    }
    if (typeof item.budgetedAmountThb === 'number') {
      r.amount = String(item.budgetedAmountThb);
    }
    if (typeof item.date === 'string' && item.date) {
      r.date = item.date;
    }
    if (item.entryType === 'labor' || item.entryType === 'material') {
      r.entryType = item.entryType;
    }
    if (typeof item.phone === 'string') {
      r.phone = item.phone;
    }
    if (typeof item.taxId === 'string') {
      r.taxId = item.taxId;
    }
    if (typeof item.address === 'string') {
      r.address = item.address;
    }
    if (typeof item.contactPerson === 'string') {
      r.contactPerson = item.contactPerson;
    }
    if (typeof item.email === 'string') {
      r.email = item.email;
    }
    if (target === 'budget_line') {
      r.categoryId = budgetCategories[0]?.id ?? '';
    }
    if (target === 'transaction') {
      r.budgetLineId = budgetLines[0]?.id ?? '';
    }
    return r;
  }

  function patch(key: string, field: keyof EditRow, value: string | boolean) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function save() {
    const included = rows.filter((r) => r.include);
    if (included.length === 0) {
      setError('noRows');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitForTarget(included);
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  async function submitForTarget(included: EditRow[]) {
    switch (target) {
      case 'transaction':
        return bulkCreateTransactions({
          flipId: flipId ?? '',
          rows: included.map((r) => ({
            description: r.description.trim(),
            amountThb: parseAmount(r.amount),
            date: r.date || undefined,
            budgetLineId: r.budgetLineId,
          })),
        });
      case 'budget_line':
        return bulkCreateBudgetLines({
          flipId: flipId ?? '',
          rows: included.map((r) => ({
            description: r.description.trim(),
            budgetedAmountThb: parseAmount(r.amount),
            categoryId: r.categoryId,
          })),
        });
      case 'milestone':
        return bulkCreateMilestones({
          assignmentId: assignmentId ?? '',
          rows: included.map((r) => ({ title: r.title.trim(), amountThb: parseAmount(r.amount) })),
        });
      case 'tm_entry':
        return bulkCreateTmEntries({
          assignmentId: assignmentId ?? '',
          rows: included.map((r) => ({
            description: r.description.trim(),
            entryType: r.entryType,
            amountThb: parseAmount(r.amount),
          })),
        });
      case 'contractor': {
        const r = included[0];
        if (!r) {
          return { ok: false, error: 'validation', issues: [] } as const;
        }
        return createContractorFromExtraction({
          name: r.name.trim(),
          phone: r.phone || null,
          taxId: r.taxId || null,
          address: r.address || null,
          contactPerson: r.contactPerson || null,
          email: r.email || null,
        });
      }
    }
  }

  const modes = TARGET_CONFIG[target].modes;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles size={14} strokeWidth={1.5} className="mr-1" />
          {triggerLabel ?? t('extract')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="flex flex-col gap-4">
            {allowedTargets.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <Label>{t('configure.target')}</Label>
                <Select
                  value={target}
                  onValueChange={(v) => {
                    const next = v as ExtractionTarget;
                    setTarget(next);
                    if (!TARGET_CONFIG[next].modes.includes(mode)) {
                      setMode(TARGET_CONFIG[next].modes[0] ?? 'single');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTargets.map((tg) => (
                      <SelectItem key={tg} value={tg}>
                        {t(`targets.${tg}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {modes.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <Label>{t('configure.mode')}</Label>
                <div className="flex gap-2">
                  {modes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                        mode === m
                          ? 'border-border-strong bg-fill-selected text-text-strong'
                          : 'border-border-subtle text-text-muted hover:bg-fill-hover'
                      }`}
                    >
                      {t(`modes.${m}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label>{t('configure.file')}</Label>
              <input
                ref={fileRef}
                type="file"
                accept={RECEIPT_CONTENT_TYPES.join(',')}
                onChange={handleFile}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload size={14} strokeWidth={1.5} className="mr-1" />
                {file ? file.name : t('configure.chooseFile')}
              </Button>
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="button" onClick={runExtract} disabled={isPending || !file}>
                <Sparkles size={14} strokeWidth={1.5} className="mr-1" />
                {isPending ? t('extracting') : t('extractCta')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{t('review.help')}</p>
            <div className="max-h-[50vh] overflow-y-auto">
              <ReviewRows
                target={target}
                rows={rows}
                budgetLines={budgetLines}
                budgetCategories={budgetCategories}
                catLabel={catLabel}
                onPatch={patch}
                onRemove={(key) => setRows((prev) => prev.filter((r) => r.key !== key))}
              />
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('configure')}>
                {t('review.back')}
              </Button>
              <Button type="button" onClick={save} disabled={isPending}>
                {t('review.saveAll', { count: rows.filter((r) => r.include).length })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewRows({
  target,
  rows,
  budgetLines,
  budgetCategories,
  catLabel,
  onPatch,
  onRemove,
}: {
  target: ExtractionTarget;
  rows: EditRow[];
  budgetLines: BudgetLineOption[];
  budgetCategories: CategoryOption[];
  catLabel: (c: CategoryOption) => string;
  onPatch: (key: string, field: keyof EditRow, value: string | boolean) => void;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations('ocr');

  if (target === 'contractor') {
    const r = rows[0];
    if (!r) {
      return null;
    }
    const fields: [keyof EditRow, string][] = [
      ['name', t('columns.name')],
      ['phone', t('columns.phone')],
      ['taxId', t('columns.taxId')],
      ['contactPerson', t('columns.contactPerson')],
      ['email', t('columns.email')],
      ['address', t('columns.address')],
    ];
    return (
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([f, label]) => (
          <div key={f} className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <Input value={String(r[f] ?? '')} onChange={(e) => onPatch(r.key, f, e.target.value)} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex items-start gap-2 rounded-md border border-border-subtle p-2"
        >
          <input
            type="checkbox"
            checked={r.include}
            onChange={(e) => onPatch(r.key, 'include', e.target.checked)}
            className="mt-2"
            aria-label={t('review.include')}
          />
          <div className="grid flex-1 grid-cols-2 gap-2">
            {target === 'milestone' ? (
              <Input
                value={r.title}
                placeholder={t('columns.title')}
                onChange={(e) => onPatch(r.key, 'title', e.target.value)}
              />
            ) : (
              <Input
                value={r.description}
                placeholder={t('columns.description')}
                onChange={(e) => onPatch(r.key, 'description', e.target.value)}
              />
            )}

            <Input
              inputMode="decimal"
              value={formatWithCommas(r.amount)}
              onChange={(e) => onPatch(r.key, 'amount', cleanNumericInput(e.target.value))}
              className="tabular text-right"
              placeholder={t('columns.amount')}
            />

            {target === 'transaction' ? (
              <>
                <Input
                  type="date"
                  value={r.date}
                  onChange={(e) => onPatch(r.key, 'date', e.target.value)}
                />
                <Select
                  value={r.budgetLineId}
                  onValueChange={(v) => onPatch(r.key, 'budgetLineId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('columns.budgetLine')} />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetLines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {catLabel(l.category)} — {l.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}

            {target === 'budget_line' ? (
              <Select value={r.categoryId} onValueChange={(v) => onPatch(r.key, 'categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('columns.category')} />
                </SelectTrigger>
                <SelectContent>
                  {budgetCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {catLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {target === 'tm_entry' ? (
              <Select value={r.entryType} onValueChange={(v) => onPatch(r.key, 'entryType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">{t('entryTypes.labor')}</SelectItem>
                  <SelectItem value="material">{t('entryTypes.material')}</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onRemove(r.key)}
            className="mt-1.5 rounded p-1 text-text-muted hover:text-destructive"
            aria-label={t('review.remove')}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
