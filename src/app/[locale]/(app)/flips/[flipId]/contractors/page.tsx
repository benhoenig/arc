import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listBudgetCategories } from '@/features/budget/queries/list-budget-categories';
import { CreateAssignmentDialog } from '@/features/contractors/components/create-assignment-dialog';
import { FlipAssignmentList } from '@/features/contractors/components/flip-assignment-list';
import { listAssignmentsForFlip } from '@/features/contractors/queries/list-assignments-for-flip';
import { listContractors } from '@/features/contractors/queries/list-contractors';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipContractorsPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [flip, assignments, contractors, budgetCategories, t] = await Promise.all([
    getFlipById(orgId, flipId),
    listAssignmentsForFlip(orgId, flipId),
    listContractors(orgId),
    listBudgetCategories(orgId),
    getTranslations('contractors'),
  ]);

  if (!flip) {
    notFound();
  }

  const locked =
    flip.stage.slug === 'sold' ||
    flip.stage.slug === 'killed' ||
    flip.soldAt != null ||
    flip.killedAt != null;

  return (
    <div className="px-6 py-6">
      <Link
        href={`/flips/${flip.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {flip.code} · {flip.name}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{t('assignments.title')}</h1>
        {!locked ? (
          <CreateAssignmentDialog
            flipId={flip.id}
            contractors={contractors}
            budgetCategories={budgetCategories}
          />
        ) : null}
      </div>

      <FlipAssignmentList
        assignments={assignments}
        budgetCategories={budgetCategories}
        readOnly={locked}
      />
    </div>
  );
}
