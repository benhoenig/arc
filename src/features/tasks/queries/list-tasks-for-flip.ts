import 'server-only';

import { db } from '@/server/db';

const taskSelect = {
  id: true,
  flipId: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  completedAt: true,
  assignedToUserId: true,
  relatedAssignmentId: true,
  flipStageId: true,
  createdAt: true,
  updatedAt: true,
  assignedToUser: {
    select: { id: true, fullName: true, displayName: true, email: true, avatarUrl: true },
  },
} as const;

export async function listTasksForFlip(orgId: string, flipId: string) {
  // Open work first (by priority then due date), completed/canceled sink to the
  // bottom. Sorting in JS keeps the multi-key ordering readable.
  const rows = await db.task.findMany({
    where: { organizationId: orgId, flipId, deletedAt: null },
    select: taskSelect,
    orderBy: [{ createdAt: 'asc' }],
  });

  return rows;
}

export type FlipTask = Awaited<ReturnType<typeof listTasksForFlip>>[number];
