import { setRequestLocale } from 'next-intl/server';
import { BudgetCategoriesPageClient } from '@/features/budget/components/budget-categories-page-client';
import { listBudgetCategories } from '@/features/budget/queries/list-budget-categories';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { isOrgAdmin } from '@/server/shared/require-admin';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BudgetCategoriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  const [isAdmin, categories] = await Promise.all([
    isOrgAdmin(user.id, orgId),
    listBudgetCategories(orgId),
  ]);

  return (
    <div className="px-6 py-6">
      <BudgetCategoriesPageClient isAdmin={isAdmin} categories={categories} />
    </div>
  );
}
