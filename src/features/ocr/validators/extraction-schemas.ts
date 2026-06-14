import { z } from 'zod';

// ============================================================================
// M6.7 — AI document extraction.
// One image/PDF → structured rows the operator reviews before saving.
// Every target extracts into an envelope `{ items: Row[] }` (single mode just
// expects one item), so the action + review table are uniform across targets.
// ============================================================================

export const EXTRACTION_TARGETS = [
  'transaction',
  'budget_line',
  'milestone',
  'tm_entry',
  'contractor',
] as const;
export type ExtractionTarget = (typeof EXTRACTION_TARGETS)[number];

export const EXTRACTION_MODES = ['single', 'batch'] as const;
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];

// Fields are nullable (not optional) so the model can explicitly say "not on
// the document" — clearer for a vision task than an absent key. We avoid
// min/max/length constraints: the SDK strips them from the JSON schema anyway
// and validates client-side, and they don't help the model.
const txRow = z.object({
  description: z.string(),
  amountThb: z.number(),
  date: z.string().nullable(),
});

const budgetLineRow = z.object({
  description: z.string(),
  budgetedAmountThb: z.number(),
});

const milestoneRow = z.object({
  title: z.string(),
  amountThb: z.number(),
});

const tmEntryRow = z.object({
  description: z.string(),
  entryType: z.enum(['labor', 'material']),
  amountThb: z.number(),
});

const contractorRow = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  taxId: z.string().nullable(),
  address: z.string().nullable(),
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
});

const ROW_SCHEMAS = {
  transaction: txRow,
  budget_line: budgetLineRow,
  milestone: milestoneRow,
  tm_entry: tmEntryRow,
  contractor: contractorRow,
} as const;

export type TxRow = z.infer<typeof txRow>;
export type BudgetLineRow = z.infer<typeof budgetLineRow>;
export type MilestoneRow = z.infer<typeof milestoneRow>;
export type TmEntryRow = z.infer<typeof tmEntryRow>;
export type ContractorRow = z.infer<typeof contractorRow>;

// Discriminated row union for the client (the action returns target + rows).
export type ExtractedRow = TxRow | BudgetLineRow | MilestoneRow | TmEntryRow | ContractorRow;

// The structured-output root must be an object → wrap the rows in `items`.
export function extractionEnvelope(target: ExtractionTarget) {
  return z.object({ items: z.array(ROW_SCHEMAS[target]) });
}

// What each target needs in scope to save, and what the extractor is told to
// look for. `context` gates which entry point can offer the target.
export const TARGET_CONFIG: Record<
  ExtractionTarget,
  {
    context: 'flip' | 'assignment' | 'org';
    modes: ExtractionMode[];
    /** Plain-language description of each row, injected into the prompt. */
    rowHint: string;
  }
> = {
  transaction: {
    context: 'flip',
    modes: ['single', 'batch'],
    rowHint:
      'a spend line item: a short Thai description of what was bought/paid, the THB amount as a plain number (no commas or ฿), and the date in ISO format (YYYY-MM-DD) if shown, else null',
  },
  budget_line: {
    context: 'flip',
    modes: ['single', 'batch'],
    rowHint:
      'a planned budget/quote line: a short Thai description of the work or material, and its planned THB cost as a plain number',
  },
  milestone: {
    context: 'assignment',
    modes: ['single', 'batch'],
    rowHint:
      'a payment milestone / stage of work: a short Thai title for the stage, and its THB amount as a plain number',
  },
  tm_entry: {
    context: 'assignment',
    modes: ['single', 'batch'],
    rowHint:
      'a time-or-materials line: a short Thai description, whether it is "labor" or "material", and its THB amount as a plain number',
  },
  contractor: {
    context: 'org',
    modes: ['single'],
    rowHint:
      "the contractor's details: company/person name, phone, tax ID, address, contact person, and email — use null for anything not present",
  },
};
