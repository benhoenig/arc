import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FlipBudgetPanel } from '@/features/budget/components/flip-budget-panel';
import { getCategoryBreakdownForFlip } from '@/features/budget/queries/get-category-breakdown';
import { getFlipBudgetSummary } from '@/features/budget/queries/get-flip-budget-summary';
import { getFlipCashSummary } from '@/features/budget/queries/get-flip-cash-summary';
import { FlipContractorsPanel } from '@/features/contractors/components/flip-contractors-panel';
import { listAssignmentsForFlip } from '@/features/contractors/queries/list-assignments-for-flip';
import { FlipDetailHeader } from '@/features/flips/components/flip-detail-header';
import { FlipFeasibilityPanel } from '@/features/flips/components/flip-feasibility-panel';
import { FlipOverviewPanel } from '@/features/flips/components/flip-overview-panel';
import { FlipRevisionsPanel } from '@/features/flips/components/flip-revisions-panel';
import { FlipTeamPanel } from '@/features/flips/components/flip-team-panel';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { getFlipPnl } from '@/features/flips/queries/get-flip-pnl';
import { listFlipRevisions } from '@/features/flips/queries/list-flip-revisions';
import { listFlipStages } from '@/features/flips/queries/list-flip-stages';
import { listOrgUsers } from '@/features/flips/queries/list-org-users';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipDetailPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [
    flip,
    stages,
    candidates,
    revisions,
    budgetSummary,
    budgetBreakdown,
    cashSummary,
    pnl,
    assignments,
  ] = await Promise.all([
    getFlipById(orgId, flipId),
    listFlipStages(orgId),
    listOrgUsers(orgId),
    listFlipRevisions(orgId, flipId),
    getFlipBudgetSummary(orgId, flipId),
    getCategoryBreakdownForFlip(orgId, flipId),
    getFlipCashSummary(orgId, flipId),
    getFlipPnl(orgId, flipId),
    listAssignmentsForFlip(orgId, flipId),
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
        flipType={flip.flipType as 'float_flip' | 'transfer_in'}
        revisionDefaults={{
          originalContractPriceThb: flip.baselinePurchasePriceThb ?? undefined,
          revisedTargetArvThb: flip.baselineTargetArvThb ?? undefined,
          revisedTargetTimelineDays: flip.baselineTargetTimelineDays ?? undefined,
        }}
        budgetSummary={{
          variancePct: budgetSummary?.variancePct ?? null,
          lineCount: budgetSummary?.lineCount ?? 0,
        }}
        cashSummary={{
          cashBalanceThb: cashSummary?.cashBalanceThb ?? 0,
          transactionCount: cashSummary?.transactionCount ?? 0,
        }}
      />

      <div className="mb-8">
        <FlipOverviewPanel
          actuals={{
            acquiredAt: flip.acquiredAt,
            listedAt: flip.listedAt,
            soldAt: flip.soldAt,
          }}
          targetTimelineDays={flip.baselineTargetTimelineDays}
          hasInvestorCapital={flip.hasInvestorCapital}
          notes={flip.notes}
        />
      </div>

      {pnl ? (
        <div className="mb-8">
          <FlipFeasibilityPanel pnl={pnl} />
        </div>
      ) : null}

      <div className="mb-8">
        <FlipBudgetPanel
          flipId={flip.id}
          summary={{
            totalBudgetedThb: budgetSummary?.totalBudgetedThb ?? 0,
            totalCommittedThb: budgetSummary?.totalCommittedThb ?? 0,
            totalActualThb: budgetSummary?.totalActualThb ?? 0,
            varianceThb: budgetSummary?.varianceThb ?? 0,
            variancePct: budgetSummary?.variancePct ?? null,
            lineCount: budgetSummary?.lineCount ?? 0,
          }}
          breakdown={budgetBreakdown}
        />
      </div>

      <div className="mb-8">
        <FlipContractorsPanel flipId={flip.id} assignments={assignments} />
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

      <div className="mt-8">
        <FlipRevisionsPanel revisions={revisions} />
      </div>
    </div>
  );
}
