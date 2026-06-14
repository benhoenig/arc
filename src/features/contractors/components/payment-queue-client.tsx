'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
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
import { Link } from '@/i18n/navigation';
import { markPaymentPaid } from '../actions/mark-payment-paid';
import { approvePayment, rejectPayment } from '../actions/payment-decisions';
import type { PaymentQueueItem } from '../queries/get-payment-queue';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentStatus,
} from '../validators/payment-schemas';
import { PaymentStatusPill } from './payment-status-pill';

export function PaymentQueueClient({ payments }: { payments: PaymentQueueItem[] }) {
  const t = useTranslations('payments');
  const [payingId, setPayingId] = useState<string | null>(null);

  if (payments.length === 0) {
    return <EmptyState title={t('queue.empty')} className="py-16" />;
  }

  const paying = payments.find((p) => p.id === payingId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">{t('queue.contractor')}</th>
              <th className="px-2 py-2 font-medium">{t('queue.flip')}</th>
              <th className="px-2 py-2 font-medium">{t('queue.for')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('fields.amount')}</th>
              <th className="px-2 py-2 font-medium">{t('payments.requested')}</th>
              <th className="px-2 py-2 font-medium">{t('fields.status')}</th>
              <th className="w-48" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border-subtle">
                <td className="px-4 py-2 font-medium text-text-strong">{p.contractor.name}</td>
                <td className="px-2 py-2 text-text-muted">
                  <Link
                    href={`/flips/${p.flip.id}/contractors/${p.assignmentId}`}
                    className="hover:underline"
                  >
                    {p.flip.code}
                  </Link>
                </td>
                <td className="px-2 py-2 text-text-muted">
                  {p.milestone ? p.milestone.title : t('payments.tmBatch')}
                </td>
                <td className="px-2 py-2 text-right tabular text-text-default">
                  <Currency amount={p.amountThb} />
                </td>
                <td className="px-2 py-2 text-text-muted">
                  <DateDisplay date={p.requestedAt} format="short" />
                </td>
                <td className="px-2 py-2">
                  <PaymentStatusPill
                    status={p.status}
                    label={t(`payments.statuses.${p.status as PaymentStatus}`)}
                  />
                </td>
                <td className="px-2 py-2">
                  <QueueRowActions payment={p} onPay={() => setPayingId(p.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paying ? (
        <MarkPaidDialog
          payment={paying}
          open
          onOpenChange={(next) => {
            if (!next) {
              setPayingId(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

function QueueRowActions({ payment, onPay }: { payment: PaymentQueueItem; onPay: () => void }) {
  const t = useTranslations('payments');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const r = await approvePayment({ id: payment.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  function reject() {
    if (!confirm(t('queue.confirmReject'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await rejectPayment({ id: payment.id });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="text-xs text-destructive">{t(`errors.${error}`)}</span> : null}
      {payment.status === 'requested' ? (
        <Button size="sm" variant="outline" onClick={approve} disabled={isPending}>
          {t('queue.approve')}
        </Button>
      ) : null}
      {payment.status === 'approved' ? (
        <Button size="sm" onClick={onPay} disabled={isPending}>
          {t('queue.markPaid')}
        </Button>
      ) : null}
      <button
        type="button"
        onClick={reject}
        disabled={isPending}
        className="text-xs text-text-muted hover:text-destructive"
      >
        {t('queue.reject')}
      </button>
    </div>
  );
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function MarkPaidDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentQueueItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(isoToday());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await markPaymentPaid({
        id: payment.id,
        paymentMethod: method,
        paymentReference: reference.trim() || undefined,
        paidAt,
      });
      if (!r.ok) {
        setError(r.error === 'conflict' ? (r.message ?? 'conflict') : r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('markPaid.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            {payment.contractor.name} ·{' '}
            <span className="tabular text-text-default">
              <Currency amount={payment.amountThb} />
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('markPaid.method')} *</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`markPaid.methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('markPaid.paidAt')} *</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('markPaid.reference')}</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('markPaid.referencePlaceholder')}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{t(`errors.${error}`)}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t('queue.markPaid')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
