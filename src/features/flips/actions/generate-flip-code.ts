import 'server-only';

import type { Prisma } from '@/generated/prisma/client';

/**
 * Allocates the next flip code for (org, current year) atomically.
 *
 * The UPSERT is the serialisation point: `next_number` starts at 2 on insert
 * (because we're consuming 1), or increments by 1 on conflict. Either way,
 * `RETURNING next_number - 1` gives the number we just allocated, so
 * concurrent callers are guaranteed distinct values.
 *
 * Must run inside the same transaction as the flip insert so the counter
 * only advances when the flip is actually persisted.
 */
export async function allocateFlipCode(
  tx: Prisma.TransactionClient,
  orgId: string,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();

  const rows = await tx.$queryRaw<Array<{ allocated: number }>>`
    INSERT INTO flip_code_counters (organization_id, year, next_number)
    VALUES (${orgId}::uuid, ${year}, 2)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET next_number = flip_code_counters.next_number + 1,
                  updated_at = now()
    RETURNING (next_number - 1) AS allocated
  `;

  const allocated = rows[0]?.allocated;
  if (!allocated || allocated < 1) {
    throw new Error('Failed to allocate flip code');
  }

  return `FLIP-${year}-${String(allocated).padStart(3, '0')}`;
}
