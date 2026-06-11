import 'server-only';

import type { Locale } from '@/lib/i18n';
import { db } from '@/server/db';

export type FlipActivityChange = {
  key: string;
  value: string | number | { from: number; to: number };
};

export type FlipActivityEntry = {
  id: string;
  entityType: string;
  action: string;
  changes: FlipActivityChange[];
  createdAt: Date;
  user: { name: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFromTo(value: unknown): value is { from: unknown; to: unknown } {
  return isRecord(value) && 'from' in value && 'to' in value;
}

// Turn a raw `changes` blob into display-ready fields: resolve foreign-key ids
// to human names, drop internal ids (flipId etc.) so no bare UUID ever renders,
// and keep amounts/strings for the component to label + format.
function normalizeChanges(
  raw: unknown,
  categoryNames: Map<string, string>,
  lineDescriptions: Map<string, string>,
): FlipActivityChange[] {
  if (!isRecord(raw)) {
    return [];
  }

  const out: FlipActivityChange[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'categoryId') {
      const name = categoryNames.get(String(value));
      if (name) {
        out.push({ key: 'category', value: name });
      }
      continue;
    }
    if (key === 'budgetLineId') {
      const desc = lineDescriptions.get(String(value));
      if (desc) {
        out.push({ key: 'budgetLine', value: desc });
      }
      continue;
    }
    // Drop every other raw id (flipId, propertyId, organizationId, …) — a UUID
    // carries no meaning in the log.
    if (key.endsWith('Id')) {
      continue;
    }
    if (isFromTo(value)) {
      out.push({ key, value: { from: Number(value.from), to: Number(value.to) } });
      continue;
    }
    if (typeof value === 'number' || typeof value === 'string') {
      out.push({ key, value });
      continue;
    }
    if (value != null) {
      out.push({ key, value: String(value) });
    }
  }
  return out;
}

// activity_log is not FK-linked to a flip, so we resolve the ids of the flip's
// financially-relevant child entities first, then pull every audit row that
// touches the flip itself or one of those children. Read-only history surface
// for "who changed what, when" — the audit data is written by the existing
// logActivity() calls across the app.
export async function listFlipActivity(
  orgId: string,
  flipId: string,
  locale: Locale,
): Promise<FlipActivityEntry[]> {
  const [dealAnalyses, budgetLines, transactions, categories] = await Promise.all([
    db.dealAnalysis.findMany({
      where: { flipId, organizationId: orgId },
      select: { id: true },
    }),
    // Include soft-deleted lines so historical references still resolve to a name.
    db.budgetLine.findMany({
      where: { flipId, organizationId: orgId },
      select: { id: true, description: true },
    }),
    db.flipTransaction.findMany({
      where: { flipId, organizationId: orgId },
      select: { id: true },
    }),
    db.budgetCategory.findMany({
      where: { organizationId: orgId },
      select: { id: true, nameTh: true, nameEn: true },
    }),
  ]);

  const categoryNames = new Map(
    categories.map((c) => [c.id, locale === 'en' && c.nameEn ? c.nameEn : c.nameTh]),
  );
  const lineDescriptions = new Map(budgetLines.map((l) => [l.id, l.description]));

  const rows = await db.activityLog.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { entityType: 'flip', entityId: flipId },
        { entityType: 'deal_analysis', entityId: { in: dealAnalyses.map((d) => d.id) } },
        { entityType: 'budget_line', entityId: { in: budgetLines.map((b) => b.id) } },
        { entityType: 'flip_transaction', entityId: { in: transactions.map((t) => t.id) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { displayName: true, fullName: true, email: true } },
    },
  });

  return rows.map((row) => ({
    // activity_log.id is BigInt — stringify so it survives the RSC boundary.
    id: row.id.toString(),
    entityType: row.entityType,
    action: row.action,
    changes: normalizeChanges(row.changes, categoryNames, lineDescriptions),
    createdAt: row.createdAt,
    user: row.user ? { name: row.user.displayName ?? row.user.fullName ?? row.user.email } : null,
  }));
}
