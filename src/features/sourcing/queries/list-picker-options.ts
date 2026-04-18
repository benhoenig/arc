import 'server-only';

import { db } from '@/server/db';

export type PickerOption = { value: string; label: string };

async function listProjectOptions(orgId: string): Promise<PickerOption[]> {
  const rows = await db.project.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({ value: r.name, label: r.name }));
}

async function listContactOptions(orgId: string): Promise<PickerOption[]> {
  const rows = await db.contact.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  // Deduplicate by name (same agent may appear on multiple properties)
  const seen = new Set<string>();
  return rows.reduce<PickerOption[]>((acc, r) => {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      acc.push({ value: r.name, label: r.name });
    }
    return acc;
  }, []);
}

export async function listPickerOptions(orgId: string) {
  const [projects, contacts] = await Promise.all([
    listProjectOptions(orgId),
    listContactOptions(orgId),
  ]);
  return { projects, contacts };
}

export type PickerOptions = Awaited<ReturnType<typeof listPickerOptions>>;
