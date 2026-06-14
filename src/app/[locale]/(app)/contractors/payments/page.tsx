import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PaymentQueueClient } from '@/features/contractors/components/payment-queue-client';
import { getPaymentQueue } from '@/features/contractors/queries/get-payment-queue';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PaymentQueuePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [payments, t] = await Promise.all([getPaymentQueue(orgId), getTranslations('payments')]);

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-strong">{t('queue.title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('queue.subtitle')}</p>
      </div>
      <PaymentQueueClient payments={payments} />
    </div>
  );
}
