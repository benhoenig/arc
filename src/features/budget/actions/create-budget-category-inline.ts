'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import { isOrgAdmin } from '@/server/shared/require-admin';
import type { ActionResult } from '@/types/common';
import type { BudgetCategoryItem } from '../queries/list-budget-categories';
import {
  type CreateBudgetCategoryInlineInput,
  createBudgetCategoryInlineSchema,
} from '../validators/budget-schemas';

/**
 * Collapse a display name into a lower snake_case slug candidate matching the
 * `^[a-z0-9_]+$` constraint. Non-ASCII input (e.g. Thai) reduces to empty — the
 * caller falls back to the next source. Capped short of 64 to leave room for a
 * numeric disambiguation suffix.
 */
function toSlugBase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
}

/**
 * Create a budget category from the budget-line dropdown with names only.
 *
 * Admin-only — same gate as `createBudgetCategory` and the settings page; the
 * dropdown only surfaces the trigger to admins, this is the server enforcement.
 * Slug is derived (English name → Thai name → generic) and disambiguated against
 * existing non-deleted slugs; sort order is appended to the end of the org list.
 * Returns the full created category so the client can add + select it instantly.
 */
export async function createBudgetCategoryInline(
  input: CreateBudgetCategoryInlineInput,
): Promise<ActionResult<BudgetCategoryItem>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!(await isOrgAdmin(user.id, orgId))) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = createBudgetCategoryInlineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const { nameTh, nameEn } = parsed.data;

  try {
    const created = await db.$transaction(async (tx) => {
      const last = await tx.budgetCategory.aggregate({
        where: { organizationId: orgId, deletedAt: null },
        _max: { sortOrder: true },
      });
      const sortOrder = (last._max.sortOrder ?? 0) + 1;

      const base = toSlugBase(nameEn ?? '') || toSlugBase(nameTh) || 'category';
      // Match the partial unique index `(organization_id, slug) WHERE deleted_at
      // IS NULL` exactly — only live slugs can collide.
      const existing = await tx.budgetCategory.findMany({
        where: { organizationId: orgId, slug: { startsWith: base }, deletedAt: null },
        select: { slug: true },
      });
      const taken = new Set(existing.map((c) => c.slug));
      let slug = base;
      let n = 2;
      while (taken.has(slug)) {
        slug = `${base}_${n}`;
        n += 1;
      }

      const row = await tx.budgetCategory.create({
        data: {
          organizationId: orgId,
          slug,
          nameTh,
          nameEn: nameEn ?? null,
          sortOrder,
          isSystem: false,
        },
        select: {
          id: true,
          slug: true,
          nameTh: true,
          nameEn: true,
          sortOrder: true,
          isSystem: true,
          parentId: true,
        },
      });

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_category',
        entityId: row.id,
        action: 'created',
        changes: { slug, nameTh, source: 'inline' },
      });

      return row;
    });

    revalidatePath('/settings/budget-categories');
    return { ok: true, data: created };
  } catch (error) {
    console.error('createBudgetCategoryInline failed', error);
    return { ok: false, error: 'server' };
  }
}
