import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { AssignmentPaymentsList } from '@/features/contractors/components/assignment-payments-list';
import { MilestonePanel } from '@/features/contractors/components/milestone-panel';
import { TmEntryPanel } from '@/features/contractors/components/tm-entry-panel';
import { getAssignment } from '@/features/contractors/queries/get-assignment';
import { listMilestonesForAssignment } from '@/features/contractors/queries/list-milestones-for-assignment';
import { listPaymentsForAssignment } from '@/features/contractors/queries/list-payments-for-assignment';
import { listTmEntriesForAssignment } from '@/features/contractors/queries/list-tm-entries-for-assignment';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/auth';

type Props = {
  params: Promise<{ locale: string; flipId: string; assignmentId: string }>;
};

export default async function AssignmentDetailPage({ params }: Props) {
  const { locale, flipId, assignmentId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const [assignment, t] = await Promise.all([
    getAssignment(orgId, assignmentId),
    getTranslations('payments'),
  ]);

  if (!assignment || assignment.flipId !== flipId) {
    notFound();
  }

  const locked = assignment.flip.killedAt != null || assignment.flip.soldAt != null;
  const isFixed = assignment.paymentModel === 'fixed_milestone';

  const [milestones, tmEntries, payments] = await Promise.all([
    isFixed ? listMilestonesForAssignment(orgId, assignmentId) : Promise.resolve([]),
    isFixed ? Promise.resolve([]) : listTmEntriesForAssignment(orgId, assignmentId),
    listPaymentsForAssignment(orgId, assignmentId),
  ]);

  return (
    <div className="px-6 py-6">
      <Link
        href={`/flips/${flipId}/contractors`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {assignment.flip.code} · {t('back')}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-strong">{assignment.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            <Link href={`/contractors/${assignment.contractorId}`} className="hover:underline">
              {assignment.contractor.name}
            </Link>{' '}
            · {t(`assignmentModels.${isFixed ? 'fixed_milestone' : 'time_materials'}`)}
          </p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div className="text-right">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              {t('summary.committed')}
            </dt>
            <dd className="tabular text-text-default">
              <Currency amount={assignment.totalCommittedThb} />
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-xs uppercase tracking-wide text-text-muted">{t('summary.paid')}</dt>
            <dd className="tabular text-text-default">
              <Currency amount={assignment.totalPaidThb} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-6">
        {isFixed ? (
          <MilestonePanel assignmentId={assignmentId} milestones={milestones} readOnly={locked} />
        ) : (
          <TmEntryPanel
            assignmentId={assignmentId}
            flipId={flipId}
            orgId={orgId}
            entries={tmEntries}
            defaultMarkupPct={assignment.tmMaterialMarkupPct}
            readOnly={locked}
          />
        )}

        <AssignmentPaymentsList payments={payments} readOnly={locked} />
      </div>
    </div>
  );
}
