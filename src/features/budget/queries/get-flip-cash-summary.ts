import 'server-only';

import { db } from '@/server/db';

export type FlipCashSummary = {
  flipId: string;
  cashBalanceThb: number;
  totalInvestorDepositsThb: number;
  totalLoansThb: number;
  totalSaleProceedsThb: number;
  totalSpendThb: number;
  totalRefundsThb: number;
  totalDistributionsThb: number;
  transactionCount: number;
};

type Row = {
  flip_id: string;
  organization_id: string;
  cash_balance_thb: string | number;
  total_investor_deposits_thb: string | number;
  total_loans_thb: string | number;
  total_sale_proceeds_thb: string | number;
  total_spend_thb: string | number;
  total_refunds_thb: string | number;
  total_distributions_thb: string | number;
  transaction_count: bigint | number;
};

// Reads from flip_cash_summary view. RLS on underlying flip_transactions
// scopes to the caller's org — organization_id filter is belt-and-suspenders.
export async function getFlipCashSummary(
  orgId: string,
  flipId: string,
): Promise<FlipCashSummary | null> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT flip_id, organization_id,
           cash_balance_thb, total_investor_deposits_thb, total_loans_thb,
           total_sale_proceeds_thb, total_spend_thb, total_refunds_thb,
           total_distributions_thb, transaction_count
    FROM flip_cash_summary
    WHERE flip_id = ${flipId}::uuid AND organization_id = ${orgId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    flipId: row.flip_id,
    cashBalanceThb: Number(row.cash_balance_thb),
    totalInvestorDepositsThb: Number(row.total_investor_deposits_thb),
    totalLoansThb: Number(row.total_loans_thb),
    totalSaleProceedsThb: Number(row.total_sale_proceeds_thb),
    totalSpendThb: Number(row.total_spend_thb),
    totalRefundsThb: Number(row.total_refunds_thb),
    totalDistributionsThb: Number(row.total_distributions_thb),
    transactionCount: Number(row.transaction_count),
  };
}
