'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toSignedAmount } from '@/features/budget/validators/transaction-schemas';
import { computeTmLineTotal } from '@/features/contractors/validators/payment-schemas';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import { db } from '@/server/db';
import { logActivity } from '@/server/shared/activity-log';
import type { ActionResult } from '@/types/common';

const amount = z.number().positive().max(1_000_000_000);
const dateInput = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'invalid_date' })
  .nullable()
  .optional();

// ---------------------------------------------------------------------------
// Transactions → flip_transactions (kind='spend'); fires the budget actual trigger.
// ---------------------------------------------------------------------------
const bulkTxSchema = z.object({
  flipId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        amountThb: amount,
        date: dateInput,
        budgetLineId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(100),
});
export type BulkTxInput = z.input<typeof bulkTxSchema>;

export async function bulkCreateTransactions(input: BulkTxInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const parsed = bulkTxSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { flipId, rows } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: flipId, organizationId: orgId, deletedAt: null },
        select: { id: true, killedAt: true, soldAt: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      if (flip.killedAt || flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }

      const lineIds = new Set(
        (
          await tx.budgetLine.findMany({
            where: { organizationId: orgId, flipId, deletedAt: null },
            select: { id: true },
          })
        ).map((l) => l.id),
      );

      for (const row of rows) {
        if (!lineIds.has(row.budgetLineId)) {
          throw new Error('not_found');
        }
        await tx.flipTransaction.create({
          data: {
            organizationId: orgId,
            flipId,
            budgetLineId: row.budgetLineId,
            date: row.date ?? new Date(),
            amountThb: toSignedAmount('spend', row.amountThb),
            description: row.description,
            kind: 'spend',
            createdBy: user.id,
            updatedBy: user.id,
          },
        });
      }

      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'flip_transaction',
        entityId: flipId,
        action: 'bulk_created',
        changes: { count: rows.length, source: 'ocr' },
      });
    });

    revalidatePath(`/flips/${flipId}/budget`);
    revalidatePath(`/flips/${flipId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapBulkError(error, 'bulkCreateTransactions');
  }
}

// ---------------------------------------------------------------------------
// Budget lines → budget_lines.
// ---------------------------------------------------------------------------
const bulkBudgetSchema = z.object({
  flipId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        budgetedAmountThb: z.number().nonnegative().max(1_000_000_000),
        categoryId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(100),
});
export type BulkBudgetInput = z.input<typeof bulkBudgetSchema>;

export async function bulkCreateBudgetLines(input: BulkBudgetInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const parsed = bulkBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { flipId, rows } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const flip = await tx.flip.findFirst({
        where: { id: flipId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!flip) {
        throw new Error('not_found');
      }
      const catIds = new Set(
        (
          await tx.budgetCategory.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: { id: true },
          })
        ).map((c) => c.id),
      );
      for (const row of rows) {
        if (!catIds.has(row.categoryId)) {
          throw new Error('not_found');
        }
        await tx.budgetLine.create({
          data: {
            organizationId: orgId,
            flipId,
            categoryId: row.categoryId,
            description: row.description,
            budgetedAmountThb: row.budgetedAmountThb,
            createdBy: user.id,
            updatedBy: user.id,
          },
        });
      }
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'budget_line',
        entityId: flipId,
        action: 'bulk_created',
        changes: { count: rows.length, source: 'ocr' },
      });
    });

    revalidatePath(`/flips/${flipId}/budget`);
    revalidatePath(`/flips/${flipId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapBulkError(error, 'bulkCreateBudgetLines');
  }
}

// ---------------------------------------------------------------------------
// Milestones → contractor_milestones (fixed_milestone assignment).
// ---------------------------------------------------------------------------
const bulkMilestoneSchema = z.object({
  assignmentId: z.string().uuid(),
  rows: z
    .array(z.object({ title: z.string().min(1).max(200), amountThb: amount }))
    .min(1)
    .max(100),
});
export type BulkMilestoneInput = z.input<typeof bulkMilestoneSchema>;

export async function bulkCreateMilestones(input: BulkMilestoneInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const parsed = bulkMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { assignmentId, rows } = parsed.data;

  try {
    const flipId = await db.$transaction(async (tx) => {
      const a = await tx.contractorAssignment.findFirst({
        where: { id: assignmentId, organizationId: orgId, deletedAt: null },
        select: {
          flipId: true,
          paymentModel: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!a) {
        throw new Error('not_found');
      }
      if (a.flip.killedAt || a.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      if (a.paymentModel !== 'fixed_milestone') {
        throw new Error('conflict:wrong_payment_model');
      }
      const last = await tx.contractorMilestone.findFirst({
        where: { assignmentId, deletedAt: null },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      let sortOrder = (last?.sortOrder ?? -1) + 1;
      for (const row of rows) {
        await tx.contractorMilestone.create({
          data: {
            organizationId: orgId,
            assignmentId,
            title: row.title,
            amountThb: row.amountThb,
            sortOrder,
          },
        });
        sortOrder += 1;
      }
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_milestone',
        entityId: assignmentId,
        action: 'bulk_created',
        changes: { count: rows.length, source: 'ocr' },
      });
      return a.flipId;
    });

    revalidatePath(`/flips/${flipId}/contractors/${assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapBulkError(error, 'bulkCreateMilestones');
  }
}

// ---------------------------------------------------------------------------
// T&M entries → contractor_tm_entries (time_materials assignment).
// labor → applied_rate = amount, days = 1; material → cost = amount, markup 0.
// ---------------------------------------------------------------------------
const bulkTmSchema = z.object({
  assignmentId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        entryType: z.enum(['labor', 'material']),
        amountThb: amount,
      }),
    )
    .min(1)
    .max(100),
});
export type BulkTmInput = z.input<typeof bulkTmSchema>;

export async function bulkCreateTmEntries(input: BulkTmInput): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const parsed = bulkTmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const { assignmentId, rows } = parsed.data;

  try {
    const flipId = await db.$transaction(async (tx) => {
      const a = await tx.contractorAssignment.findFirst({
        where: { id: assignmentId, organizationId: orgId, deletedAt: null },
        select: {
          flipId: true,
          paymentModel: true,
          flip: { select: { killedAt: true, soldAt: true } },
        },
      });
      if (!a) {
        throw new Error('not_found');
      }
      if (a.flip.killedAt || a.flip.soldAt) {
        throw new Error('conflict:flip_closed');
      }
      if (a.paymentModel !== 'time_materials') {
        throw new Error('conflict:wrong_payment_model');
      }
      const today = new Date();
      for (const row of rows) {
        const isLabor = row.entryType === 'labor';
        const lineTotal = computeTmLineTotal({
          entryType: row.entryType,
          appliedRateThb: isLabor ? row.amountThb : null,
          daysWorked: isLabor ? 1 : null,
          materialCostThb: isLabor ? null : row.amountThb,
          materialMarkupPct: isLabor ? null : 0,
        });
        await tx.contractorTmEntry.create({
          data: {
            organizationId: orgId,
            assignmentId,
            entryType: row.entryType,
            entryDate: today,
            description: row.description,
            appliedRateThb: isLabor ? row.amountThb : null,
            daysWorked: isLabor ? 1 : null,
            materialCostThb: isLabor ? null : row.amountThb,
            materialMarkupPct: isLabor ? null : 0,
            lineTotalThb: lineTotal,
            createdBy: user.id,
          },
        });
      }
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor_tm_entry',
        entityId: assignmentId,
        action: 'bulk_created',
        changes: { count: rows.length, source: 'ocr' },
      });
      return a.flipId;
    });

    revalidatePath(`/flips/${flipId}/contractors/${assignmentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return mapBulkError(error, 'bulkCreateTmEntries');
  }
}

// ---------------------------------------------------------------------------
// Contractor → contractors (single).
// ---------------------------------------------------------------------------
const createContractorSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).nullable().optional(),
  taxId: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
});
export type CreateContractorFromExtractionInput = z.input<typeof createContractorSchema>;

export async function createContractorFromExtraction(
  input: CreateContractorFromExtractionInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const orgId = await getActiveOrgId();
  const parsed = createContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }
  const d = parsed.data;

  try {
    const row = await db.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          organizationId: orgId,
          name: d.name,
          contractorType: 'company',
          phone: d.phone ?? null,
          taxId: d.taxId ?? null,
          address: d.address ?? null,
          contactPerson: d.contactPerson ?? null,
          email: d.email ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        select: { id: true },
      });
      await logActivity(tx, {
        orgId,
        userId: user.id,
        entityType: 'contractor',
        entityId: created.id,
        action: 'created',
        changes: { source: 'ocr' },
      });
      return created;
    });

    revalidatePath('/contractors');
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return mapBulkError(error, 'createContractorFromExtraction');
  }
}

function mapBulkError(error: unknown, label: string): ActionResult<never> {
  if (error instanceof Error) {
    if (error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    if (error.message.startsWith('conflict:')) {
      return { ok: false, error: 'conflict', message: error.message.slice('conflict:'.length) };
    }
  }
  console.error(`${label} failed`, error);
  return { ok: false, error: 'server' };
}
