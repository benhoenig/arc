import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.SUPABASE_DB_URL_POOLED });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.db ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.db = db;
}
