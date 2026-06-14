import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddTransactionDialog } from '@/features/budget/components/add-transaction-dialog';
import { BudgetBurnBar } from '@/features/budget/components/budget-burn-bar';
import { BudgetTable } from '@/features/budget/components/budget-table';
import { BudgetVarianceCard } from '@/features/budget/components/budget-variance-card';
import { CategoryBreakdownChart } from '@/features/budget/components/category-breakdown-chart';
import { FlipCashBalanceIndicator } from '@/features/budget/components/flip-cash-balance-indicator';
import { FlipTransactionList } from '@/features/budget/components/flip-transaction-list';
import { getCategoryBreakdownForFlip } from '@/features/budget/queries/get-category-breakdown';
import { getFlipBudgetSummary } from '@/features/budget/queries/get-flip-budget-summary';
import { getFlipCashSummary } from '@/features/budget/queries/get-flip-cash-summary';
import { listBudgetCategories } from '@/features/budget/queries/list-budget-categories';
import { listBudgetLinesForFlip } from '@/features/budget/queries/list-budget-lines';
import { listTransactionsForFlip } from '@/features/budget/queries/list-flip-transactions';
import { getFlipById } from '@/features/flips/queries/get-flip';
import { ExtractDialog } from '@/features/ocr/components/extract-dialog';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { isOrgAdmin } from '@/server/shared/require-admin';

type Props = {
  params: Promise<{ locale: string; flipId: string }>;
};

export default async function FlipBudgetPage({ params }: Props) {
  const { locale, flipId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const user = await requireAuth(); // cached per request — no extra round trip
  const [flip, lines, categories, summary, breakdown, cashSummary, transactions, isAdmin] =
    await Promise.all([
      getFlipById(orgId, flipId),
      listBudgetLinesForFlip(orgId, flipId),
      listBudgetCategories(orgId),
      getFlipBudgetSummary(orgId, flipId),
      getCategoryBreakdownForFlip(orgId, flipId),
      getFlipCashSummary(orgId, flipId),
      listTransactionsForFlip(orgId, flipId),
      isOrgAdmin(user.id, orgId),
    ]);

  if (!flip) {
    notFound();
  }

  const t = await getTranslations('budget');
  const locked =
    flip.stage.slug === 'sold' ||
    flip.stage.slug === 'killed' ||
    flip.soldAt != null ||
    flip.killedAt != null;

  const totals = summary ?? {
    totalBudgetedThb: 0,
    totalCommittedThb: 0,
    totalActualThb: 0,
    varianceThb: 0,
    variancePct: null,
    lineCount: 0,
    flipId,
  };

  return (
    <div className="px-6 py-6">
      <Link
        href={`/flips/${flip.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {flip.code} · {flip.name}
      </Link>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text-strong">{t('title')}</h1>
        <FlipCashBalanceIndicator
          cashBalanceThb={cashSummary?.cashBalanceThb ?? 0}
          transactionCount={cashSummary?.transactionCount ?? 0}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <BudgetVarianceCard
          totalBudgetedThb={totals.totalBudgetedThb}
          totalCommittedThb={totals.totalCommittedThb}
          totalActualThb={totals.totalActualThb}
          varianceThb={totals.varianceThb}
          variancePct={totals.variancePct}
        />
        <div className="rounded-md border border-border bg-surface p-4">
          <BudgetBurnBar
            totalBudgetedThb={totals.totalBudgetedThb}
            totalCommittedThb={totals.totalCommittedThb}
            totalActualThb={totals.totalActualThb}
          />
        </div>
      </div>

      <div className="mb-6">
        <BudgetTable
          flipId={flip.id}
          orgId={orgId}
          lines={lines}
          categories={categories}
          canCreateCategory={isAdmin}
          readOnly={locked}
        />
      </div>

      <div className="mb-6 rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-text-strong">{t('transactions.title')}</h2>
          {!locked ? (
            <div className="flex items-center gap-2">
              <ExtractDialog
                orgId={orgId}
                flipId={flip.id}
                allowedTargets={['transaction', 'budget_line']}
                budgetLines={lines}
                budgetCategories={categories}
              />
              <AddTransactionDialog
                flipId={flip.id}
                orgId={orgId}
                budgetLines={lines}
                defaultKind="investor_deposit"
              />
            </div>
          ) : null}
        </div>
        <FlipTransactionList transactions={transactions} readOnly={locked} />
      </div>

      <div className="rounded-md border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-strong">{t('categoryChart.title')}</h2>
        <CategoryBreakdownChart rows={breakdown} />
      </div>
    </div>
  );
}
