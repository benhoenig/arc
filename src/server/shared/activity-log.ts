import 'server-only';

import type { Prisma, PrismaClient } from '@/generated/prisma/client';

type LogActivityParams = {
  orgId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Prisma.InputJsonValue;
  context?: Prisma.InputJsonValue;
};

type DbClient = { activityLog: PrismaClient['activityLog'] };

export async function logActivity(tx: DbClient, params: LogActivityParams): Promise<void> {
  await tx.activityLog.create({
    data: {
      organizationId: params.orgId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changes: params.changes ?? undefined,
      context: params.context ?? {},
    },
  });
}
