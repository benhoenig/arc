import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContractorTable } from '@/features/contractors/components/contractor-table';
import { CreateContractorDialog } from '@/features/contractors/components/create-contractor-dialog';
import { listContractors } from '@/features/contractors/queries/list-contractors';
import { ExtractDialog } from '@/features/ocr/components/extract-dialog';
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
        <div className="flex items-center gap-2">
          <ExtractDialog orgId={orgId} allowedTargets={['contractor']} />
          <CreateContractorDialog />
        </div>
      </div>
      <ContractorTable contractors={contractors} />
    </div>
  );
}
