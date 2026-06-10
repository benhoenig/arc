import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContractorTable } from '@/features/contractors/components/contractor-table';
import { CreateContractorDialog } from '@/features/contractors/components/create-contractor-dialog';
import { listContractors } from '@/features/contractors/queries/list-contractors';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ContractorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [contractors, t] = await Promise.all([
    listContractors(orgId),
    getTranslations('contractors'),
  ]);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{t('title')}</h1>
        <CreateContractorDialog />
      </div>
      <ContractorTable contractors={contractors} />
    </div>
  );
}
