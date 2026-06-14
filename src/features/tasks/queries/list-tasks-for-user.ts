import 'server-only';

import { db } from '@/server/db';

// Cross-flip "my day" inbox: open tasks assigned to a user across every flip in
// the org. Completed/canceled tasks are excluded — this is a to-do list, not a
// history. Carries flip code/name so the UI can deep-link back to each flip.
export async function listTasksForUser(orgId: string, userId: string) {
  return db.task.findMany({
    where: {
      organizationId: orgId,
      assignedToUserId: userId,
      status: { in: ['open', 'in_progress', 'blocked'] },
      deletedAt: null,
    },
    select: {
      id: true,
      flipId: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      dueDate: true,
      createdAt: true,
      flip: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
}

export type UserTask = Awaited<ReturnType<typeof listTasksForUser>>[number];
