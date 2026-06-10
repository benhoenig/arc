import 'server-only';

import { db } from '@/server/db';

export type ActiveCommitment = {
  contractorId: string;
  name: string;
  activeAssignmentsCount: number;
  activeContractTotalThb: number | null;
  activePaidThb: number | null;
  earliestStart: Date | null;
  latestTargetEnd: Date | null;
  activeFlipIds: string[];
};

type Row = {
  contractor_id: string;
  organization_id: string;
  name: string;
  active_assignments_count: bigint | number;
  active_contract_total_thb: string | number | null;
  active_paid_thb: string | number | null;
  earliest_start: Date | null;
  latest_target_end: Date | null;
  active_flip_ids: string[] | null;
};

// Reads from the contractor_active_commitments view (§13.2). Returns one
// row per contractor in the org; contractors with no active work still
// appear with zero counts.
export async function getContractorActiveCommitments(orgId: string): Promise<ActiveCommitment[]> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT contractor_id, organization_id, name,
           active_assignments_count,
           active_contract_total_thb,
           active_paid_thb,
           earliest_start,
           latest_target_end,
           active_flip_ids
    FROM contractor_active_commitments
    WHERE organization_id = ${orgId}::uuid
    ORDER BY name
  `;

  return rows.map((r) => ({
    contractorId: r.contractor_id,
    name: r.name,
    activeAssignmentsCount: Number(r.active_assignments_count),
    activeContractTotalThb:
      r.active_contract_total_thb != null ? Number(r.active_contract_total_thb) : null,
    activePaidThb: r.active_paid_thb != null ? Number(r.active_paid_thb) : null,
    earliestStart: r.earliest_start,
    latestTargetEnd: r.latest_target_end,
    activeFlipIds: r.active_flip_ids ?? [],
  }));
}
