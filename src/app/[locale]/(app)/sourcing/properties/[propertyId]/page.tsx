import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { Pill } from '@/components/data-display/pill';
import { DealAnalysisCard } from '@/features/sourcing/components/deal-analysis-card';
import { DealAnalysisForm } from '@/features/sourcing/components/deal-analysis-form';
import { PropertyHeaderActions } from '@/features/sourcing/components/property-header-actions';
import { getProperty } from '@/features/sourcing/queries/get-property';
import { listPickerOptions } from '@/features/sourcing/queries/list-picker-options';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; propertyId: string }>;
};

export default async function PropertyDetailPage({ params }: Props) {
  const { locale, propertyId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [property, pickerOptions] = await Promise.all([
    getProperty(orgId, propertyId),
    listPickerOptions(orgId),
  ]);

  if (!property) {
    notFound();
  }

  const t = await getTranslations('sourcing');
  const tTypes = await getTranslations('sourcing.propertyTypes');

  return (
    <div className="px-6 py-6">
      <Link
        href="/sourcing/properties"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('detail.backToList')}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-strong">{property.listingName}</h1>
            <Pill>{tTypes(property.propertyType)}</Pill>
          </div>
          {property.project && (
            <p className="mt-1 text-sm text-text-muted">{property.project.name}</p>
          )}
          {property.askingPriceThb && (
            <p className="mt-1 text-sm font-medium">
              <Currency amount={Number(property.askingPriceThb)} />
              {property.priceRemark && (
                <span className="ml-2 font-normal text-text-muted">({property.priceRemark})</span>
              )}
            </p>
          )}
        </div>
        <PropertyHeaderActions property={property} pickerOptions={pickerOptions} />
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-text-strong">
          {t('detail.analyses', { count: property.dealAnalyses.length })}
        </h2>

        {property.dealAnalyses.length > 0 && (
          <div className="mb-6 space-y-3">
            {property.dealAnalyses.map((da) => (
              <DealAnalysisCard key={da.id} analysis={da} />
            ))}
          </div>
        )}
      </div>

      <div className="max-w-xl">
        <h2 className="mb-4 text-lg font-semibold text-text-strong">
          {t('dealAnalysis.addAnalysis')}
        </h2>
        <DealAnalysisForm propertyId={property.id} />
      </div>
    </div>
  );
}
