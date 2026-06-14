'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Currency } from '@/components/data-display/currency';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import type { BudgetCategoryItem } from '@/features/budget/queries/list-budget-categories';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n';
import { deleteAssignment } from '../actions/delete-assignment';
import type { AssignmentItem } from '../queries/list-assignments-for-flip';
import type {
  AssignmentStatus,
  ContractorTrade,
  PaymentModel,
} from '../validators/contractor-schemas';
import { AssignmentStatusMenu } from './assignment-status-menu';
import { EditAssignmentDialog } from './edit-assignment-dialog';

type Props = {
  assignments: AssignmentItem[];
  budgetCategories?: BudgetCategoryItem[];
  readOnly?: boolean;
};

export function FlipAssignmentList({
  assignments,
  budgetCategories = [],
  readOnly = false,
}: Props) {
  const t = useTranslations('contractors');
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState<AssignmentItem | null>(null);

  if (assignments.length === 0) {
    return <EmptyState title={t('assignments.empty')} className="py-8" />;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">{t('assignments.columns.contractor')}</th>
              <th className="px-2 py-2 font-medium">{t('assignments.columns.title')}</th>
              <th className="px-2 py-2 font-medium">{t('assignments.columns.paymentModel')}</th>
              <th className="px-2 py-2 text-right font-medium">
                {t('assignments.columns.amount')}
              </th>
              <th className="px-2 py-2 font-medium">{t('assignments.columns.startDate')}</th>
              <th className="px-2 py-2 font-medium">{t('assignments.columns.endDate')}</th>
              <th className="px-2 py-2 text-right font-medium">
                {t('assignments.columns.status')}
              </th>
              {!readOnly ? <th className="w-20" /> : null}
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const categoryLabel = a.budgetCategory
                ? locale === 'en' && a.budgetCategory.nameEn
                  ? a.budgetCategory.nameEn
                  : a.budgetCategory.nameTh
                : null;
              return (
                <tr key={a.id} className="border-t border-border-subtle">
                  <td className="px-4 py-2">
                    <Link
                      href={`/contractors/${a.contractor.id}`}
                      className="font-medium text-text-strong hover:underline"
                    >
                      {a.contractor.name}
                    </Link>
                    {a.contractor.primaryTrade ? (
                      <div className="text-xs text-text-muted">
                        {t(`trades.${a.contractor.primaryTrade as ContractorTrade}`)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-text-default">
                    <Link
                      href={`/flips/${a.flipId}/contractors/${a.id}`}
                      className="font-medium text-text-strong hover:underline"
                    >
                      {a.title}
                    </Link>
                    {categoryLabel ? (
                      <div className="text-xs text-text-muted">{categoryLabel}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-text-muted">
                    {t(`paymentModels.${a.paymentModel as PaymentModel}`)}
                  </td>
                  <td className="px-2 py-2 text-right tabular text-text-default">
                    {a.contractAmountThb != null ? (
                      <Currency amount={a.contractAmountThb} />
                    ) : a.tmDailyRateThb != null ? (
                      <Currency amount={a.tmDailyRateThb} />
                    ) : a.tmHourlyRateThb != null ? (
                      <Currency amount={a.tmHourlyRateThb} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-2 text-text-muted">
                    {a.startDate ? <DateDisplay date={a.startDate} format="short" /> : '—'}
                  </td>
                  <td className="px-2 py-2 text-text-muted">
                    {a.targetEndDate ? <DateDisplay date={a.targetEndDate} format="short" /> : '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <AssignmentStatusMenu
                      assignmentId={a.id}
                      currentStatus={a.status as AssignmentStatus}
                      disabled={readOnly}
                    />
                  </td>
                  {!readOnly ? (
                    <td className="w-20 px-2 py-2 text-right">
                      <RowActions assignment={a} onEdit={() => setEditing(a)} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EditAssignmentDialog
          open={editing != null}
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null);
            }
          }}
          assignment={editing}
          budgetCategories={budgetCategories}
        />
      ) : null}
    </>
  );
}

function RowActions({ assignment, onEdit }: { assignment: AssignmentItem; onEdit: () => void }) {
  const t = useTranslations('contractors');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canDelete = assignment.status === 'draft';

  function handleDelete() {
    if (!canDelete) {
      return;
    }
    if (!confirm(t('assignments.confirmDelete'))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteAssignment({ id: assignment.id });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default"
        aria-label={tCommon('edit')}
        title={tCommon('edit')}
      >
        <Pencil size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || isPending}
        className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={tCommon('delete')}
        title={canDelete ? tCommon('delete') : t('assignments.deleteOnlyDraft')}
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
      {error ? <span className="sr-only">{error}</span> : null}
    </div>
  );
}
