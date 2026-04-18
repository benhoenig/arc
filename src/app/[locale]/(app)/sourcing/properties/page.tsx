import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PropertiesPageClient } from '@/features/sourcing/components/properties-page-client';
import { listPickerOptions } from '@/features/sourcing/queries/list-picker-options';
import { listProperties } from '@/features/sourcing/queries/list-properties';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PropertiesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [properties, pickerOptions] = await Promise.all([
    listProperties(orgId),
    listPickerOptions(orgId),
  ]);
  const t = await getTranslations('sourcing.properties');

  return (
    <PropertiesPageClient
      properties={properties}
      title={t('title')}
      addLabel={t('addProperty')}
      pickerOptions={pickerOptions}
      orgId={orgId}
    />
  );
}
