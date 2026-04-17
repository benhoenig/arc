import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { Pill } from '@/components/data-display/pill';
import { DealAnalysisForm } from '@/features/sourcing/components/deal-analysis-form';
import { getProperty } from '@/features/sourcing/queries/get-property';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; propertyId: string }>;
};

export default async function PropertyDetailPage({ params }: Props) {
  const { locale, propertyId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const property = await getProperty(orgId, propertyId);

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

      <div className="mb-6">
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

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-text-strong">
          {t('detail.analyses', { count: property.dealAnalyses.length })}
        </h2>

        {property.dealAnalyses.length > 0 && (
          <div className="mb-6 space-y-3">
            {property.dealAnalyses.map((da) => (
              <div key={da.id} className="rounded-md border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <DateDisplay
                    date={da.createdAt}
                    format="short"
                    className="text-sm text-text-muted"
                  />
                  {da.decision && (
                    <Pill
                      variant={
                        da.decision === 'pursue'
                          ? 'positive'
                          : da.decision === 'pass'
                            ? 'muted'
                            : 'neutral'
                      }
                    >
                      {t(`decision.${da.decision}`)}
                    </Pill>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-text-muted">{t('dealAnalysis.totalCost')}: </span>
                    <Currency amount={Number(da.totalCostThb)} className="font-medium" />
                  </div>
                  <div>
                    <span className="text-text-muted">{t('dealAnalysis.profit')}: </span>
                    <Currency amount={Number(da.estProfitThb)} className="font-medium" />
                  </div>
                  <div>
                    <span className="text-text-muted">{t('dealAnalysis.margin')}: </span>
                    <span className="tabular font-medium">
                      {Number(da.estMarginPct).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">{t('dealAnalysis.roi')}: </span>
                    <span className="tabular font-medium">{Number(da.estRoiPct).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
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
