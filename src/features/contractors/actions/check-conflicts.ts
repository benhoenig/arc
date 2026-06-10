'use server';

import { getContractorConflicts } from '@/features/contractors/queries/get-contractor-conflicts';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import type { ActionResult } from '@/types/common';

export type ConflictAssignment = {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  targetEndDate: Date | null;
  flip: { id: string; code: string; name: string };
};

// Server action wrapper so the dialog can call conflict-detection from the
// client. Query itself is server-only.
export async function checkConflicts(input: {
  contractorId: string;
  startDate: string | null;
  targetEndDate: string | null;
  excludeAssignmentId?: string;
}): Promise<ActionResult<{ conflicts: ConflictAssignment[] }>> {
  await requireAuth();
  const orgId = await getActiveOrgId();

  try {
    const rows = await getContractorConflicts(
      orgId,
      input.contractorId,
      input.startDate,
      input.targetEndDate,
      input.excludeAssignmentId,
    );
    return { ok: true, data: { conflicts: rows } };
  } catch (error) {
    console.error('checkConflicts failed', error);
    return { ok: false, error: 'server' };
  }
}
