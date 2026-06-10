import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/data-display/empty-state';
import { FlipAssignmentList } from '@/features/contractors/components/flip-assignment-list';
import type { AssignmentItem } from '@/features/contractors/queries/list-assignments-for-flip';
import { Link } from '@/i18n/navigation';

type Props = {
  flipId: string;
  assignments: AssignmentItem[];
};

// Read-only summary on the flip detail page. Full management (create / edit /
// status transitions) lives on /flips/[id]/contractors. Same pattern as the
// budget panel.
export async function FlipContractorsPanel({ flipId, assignments }: Props) {
  const t = await getTranslations('contractors');

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-strong">
          {t('title')}
          <span className="ml-2 text-xs font-normal text-text-muted">({assignments.length})</span>
        </h2>
        <Link
          href={`/flips/${flipId}/contractors`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-default"
        >
          {t('assignments.add')}
          <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>
      {assignments.length === 0 ? (
        <EmptyState title={t('assignments.empty')} className="py-6" />
      ) : (
        <FlipAssignmentList assignments={assignments} readOnly />
      )}
    </div>
  );
}
