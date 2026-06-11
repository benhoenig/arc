'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { Currency } from '@/components/data-display/currency';
import { EmptyState } from '@/components/data-display/empty-state';
import type { Locale } from '@/lib/i18n';
import type { BudgetCategoryItem } from '../queries/list-budget-categories';
import type { BudgetLineItem } from '../queries/list-budget-lines';
import { AddBudgetLineDialog } from './add-budget-line-dialog';
import { BudgetLineRow } from './budget-line-row';

type Props = {
  flipId: string;
  orgId: string;
  lines: BudgetLineItem[];
  categories: BudgetCategoryItem[];
  /** Admins may create a category inline from the add-line dialog. */
  canCreateCategory?: boolean;
  readOnly?: boolean;
};

type CategoryGroup = {
  category: BudgetLineItem['category'];
  lines: BudgetLineItem[];
};

function groupByCategory(lines: BudgetLineItem[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const line of lines) {
    const key = line.category.id;
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(line);
    } else {
      map.set(key, { category: line.category, lines: [line] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.category.sortOrder - b.category.sortOrder);
}

function sumGroup(lines: BudgetLineItem[]) {
  return lines.reduce(
    (acc, l) => ({
      budgeted: acc.budgeted + l.budgetedAmountThb,
      committed: acc.committed + l.committedAmountThb,
      actual: acc.actual + l.actualAmountThb,
    }),
    { budgeted: 0, committed: 0, actual: 0 },
  );
}

export function BudgetTable({
  flipId,
  orgId,
  lines,
  categories,
  canCreateCategory = false,
  readOnly = false,
}: Props) {
  const t = useTranslations('budget');
  const locale = useLocale() as Locale;

  const groups = groupByCategory(lines);
  const grand = sumGroup(lines);

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('table.title')}</h2>
        {!readOnly ? (
          <AddBudgetLineDialog
            flipId={flipId}
            categories={categories}
            canCreateCategory={canCreateCategory}
          />
        ) : null}
      </div>

      {lines.length === 0 ? (
        <EmptyState title={t('table.empty')} className="py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t('table.description')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('table.budgeted')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('table.committed')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('table.actual')}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const subtotals = sumGroup(group.lines);
                const label =
                  locale === 'en' && group.category.nameEn
                    ? group.category.nameEn
                    : group.category.nameTh;
                return (
                  <Fragment key={group.category.id}>
                    <tr className="bg-surface">
                      <td
                        className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"
                        colSpan={5}
                      >
                        {label}
                      </td>
                    </tr>
                    {group.lines.map((line) => (
                      <BudgetLineRow
                        key={line.id}
                        line={line}
                        flipId={flipId}
                        orgId={orgId}
                        allLines={lines}
                        readOnly={readOnly}
                      />
                    ))}
                    <tr className="border-t border-border-subtle">
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-text-muted">
                        {t('table.subtotal')}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-medium text-text-default">
                        <Currency amount={subtotals.budgeted} />
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-medium text-text-default">
                        <Currency amount={subtotals.committed} />
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-medium text-text-default">
                        <Currency amount={subtotals.actual} />
                      </td>
                      <td />
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-border bg-surface">
                <td className="px-4 py-2 text-right text-sm font-semibold text-text-strong">
                  {t('table.total')}
                </td>
                <td className="px-2 py-2 text-right text-sm font-semibold text-text-strong">
                  <Currency amount={grand.budgeted} />
                </td>
                <td className="px-2 py-2 text-right text-sm font-semibold text-text-strong">
                  <Currency amount={grand.committed} />
                </td>
                <td className="px-2 py-2 text-right text-sm font-semibold text-text-strong">
                  <Currency amount={grand.actual} />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
