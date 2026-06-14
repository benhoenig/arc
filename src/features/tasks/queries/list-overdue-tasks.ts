import 'server-only';

import { db } from '@/server/db';

// Org-wide overdue tasks (due before today, still open). Used by the portfolio
// dashboard (M11) and as a cross-flip attention list. Compared against the
// current date at day granularity.
export async function listOverdueTasks(orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db.task.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['open', 'in_progress', 'blocked'] },
      dueDate: { lt: today },
      deletedAt: null,
    },
    select: {
      id: true,
      flipId: true,
      title: true,
      priority: true,
      status: true,
      dueDate: true,
      flip: { select: { id: true, code: true, name: true } },
      assignedToUser: { select: { id: true, fullName: true, displayName: true, email: true } },
    },
    orderBy: [{ dueDate: 'asc' }],
  });
}

export type OverdueTask = Awaited<ReturnType<typeof listOverdueTasks>>[number];
