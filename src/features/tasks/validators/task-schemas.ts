import { z } from 'zod';

// Task priority + status enums mirror the DB CHECK constraints (§7.1).
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done', 'canceled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Statuses an operator can set directly via updateTask. `done` is reached only
// through completeTask (it stamps completed_at/by); reverting to `open` is
// reopenTask. Keeps the completion audit fields honest.
export const TASK_SETTABLE_STATUSES = ['open', 'in_progress', 'blocked', 'canceled'] as const;
export type TaskSettableStatus = (typeof TASK_SETTABLE_STATUSES)[number];

// Dates: accept ISO date strings (YYYY-MM-DD) from <input type="date">, coerce
// to Date. Server Actions serialise args, so Date instances may arrive as
// strings — expose z.input as the payload type. Matches the contractors module.
const dateInput = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'invalid_date' });

export const createTaskSchema = z.object({
  flipId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  assignedToUserId: z.string().uuid().optional(),
  relatedAssignmentId: z.string().uuid().optional(),
  flipStageId: z.string().uuid().optional(),
  priority: z.enum(TASK_PRIORITIES).default('normal'),
  dueDate: dateInput.optional(),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

// Every field optional so the UI can patch a single field. `id` identifies the
// task. `done` is excluded — use completeTask/reopenTask for that transition.
export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  relatedAssignmentId: z.string().uuid().nullable().optional(),
  flipStageId: z.string().uuid().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_SETTABLE_STATUSES).optional(),
  dueDate: dateInput.nullable().optional(),
});
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const assignTaskSchema = z.object({
  id: z.string().uuid(),
  assignedToUserId: z.string().uuid().nullable(),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const taskIdSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Milestones (§7.2) — flip-level timeline checkpoints
// ---------------------------------------------------------------------------

export const createMilestoneSchema = z.object({
  flipId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  targetDate: dateInput,
  isCritical: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  targetDate: dateInput.optional(),
  isCritical: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;

// actual_date nullable: setting it marks the milestone hit; clearing it reopens.
export const markMilestoneActualSchema = z.object({
  id: z.string().uuid(),
  actualDate: dateInput.nullable(),
});
export type MarkMilestoneActualInput = z.input<typeof markMilestoneActualSchema>;

export const milestoneIdSchema = z.object({ id: z.string().uuid() });
