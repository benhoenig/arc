import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FlipDetailHeader } from '@/features/flips/components/flip-detail-header';
import { FlipOverviewPanel } from '@/features/flips/components/flip-overview-panel';
import { FlipTeamPanel } from '@/features/flips/components/flip-team-panel';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { listFlipStages } from '@/features/flips/queries/list-flip-stages';
import { listOrgUsers } from '@/features/flips/queries/list-org-users';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipDetailPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [flip, stages, candidates] = await Promise.all([
    getFlipById(orgId, flipId),
    listFlipStages(orgId),
    listOrgUsers(orgId),
  ]);

  if (!flip) {
    notFound();
  }

  const t = await getTranslations('flips');
  const stageLabel = locale === 'en' && flip.stage.nameEn ? flip.stage.nameEn : flip.stage.nameTh;

  const locked =
    flip.stage.slug === 'sold' ||
    flip.stage.slug === 'killed' ||
    flip.soldAt != null ||
    flip.killedAt != null;

  return (
    <div className="px-6 py-6">
      <Link
        href="/flips"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('actions.backToFlips')}
      </Link>

      <FlipDetailHeader
        flipId={flip.id}
        code={flip.code}
        name={flip.name}
        stageId={flip.stageId}
        stageSlug={flip.stage.slug}
        stageLabel={stageLabel}
        property={{
          id: flip.property.id,
          listingName: flip.property.listingName,
          thumbnailPath: flip.property.thumbnailPath,
        }}
        isOnHold={flip.isOnHold}
        soldAt={flip.soldAt}
        killedAt={flip.killedAt}
        stages={stages}
      />

      <div className="mb-8">
        <FlipOverviewPanel
          baseline={{
            purchasePriceThb: flip.baselinePurchasePriceThb,
            renovationBudgetThb: flip.baselineRenovationBudgetThb,
            targetArvThb: flip.baselineTargetArvThb,
            targetMarginPct: flip.baselineTargetMarginPct,
            targetTimelineDays: flip.baselineTargetTimelineDays,
          }}
          actuals={{
            actualPurchasePriceThb: flip.actualPurchasePriceThb,
            acquiredAt: flip.acquiredAt,
            listedAt: flip.listedAt,
            soldAt: flip.soldAt,
            actualSalePriceThb: flip.actualSalePriceThb,
          }}
          hasInvestorCapital={flip.hasInvestorCapital}
          notes={flip.notes}
        />
      </div>

      <FlipTeamPanel
        flipId={flip.id}
        members={flip.teamMembers.map((m) => ({
          id: m.id,
          roleInFlip: m.roleInFlip,
          assignedAt: m.assignedAt,
          user: m.user,
        }))}
        candidates={candidates}
        readOnly={locked}
      />
    </div>
  );
}
