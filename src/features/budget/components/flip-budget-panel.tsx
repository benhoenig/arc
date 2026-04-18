import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BudgetBurnBar } from './budget-burn-bar';
import { BudgetVarianceCard } from './budget-variance-card';
import { CategoryBreakdownChart } from './category-breakdown-chart';

type Props = {
  flipId: string;
  summary: {
    totalBudgetedThb: number;
    totalCommittedThb: number;
    totalActualThb: number;
    varianceThb: number;
    variancePct: number | null;
    lineCount: number;
  };
  breakdown: React.ComponentProps<typeof CategoryBreakdownChart>['rows'];
};

export async function FlipBudgetPanel({ flipId, summary, breakdown }: Props) {
  const t = await getTranslations('budget');

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-strong">{t('title')}</h2>
        <Link
          href={`/flips/${flipId}/budget`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-default"
        >
          {t('panel.viewFull')}
          <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>

      <div className="mb-4">
        <BudgetVarianceCard
          totalBudgetedThb={summary.totalBudgetedThb}
          totalCommittedThb={summary.totalCommittedThb}
          totalActualThb={summary.totalActualThb}
          varianceThb={summary.varianceThb}
          variancePct={summary.variancePct}
        />
      </div>

      <div className="mb-4 rounded-md border border-border bg-surface p-4">
        <BudgetBurnBar
          totalBudgetedThb={summary.totalBudgetedThb}
          totalCommittedThb={summary.totalCommittedThb}
          totalActualThb={summary.totalActualThb}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('categoryChart.title')}
        </h3>
        <CategoryBreakdownChart rows={breakdown} />
      </div>
    </div>
  );
}
