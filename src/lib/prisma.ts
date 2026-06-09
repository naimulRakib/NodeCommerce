import { PrismaClient } from "@/generated/prisma";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL } from "@/lib/env";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

// Reuse existing pool across hot reloads to prevent connection leaks.
const pool = globalForPrisma.pgPool ?? new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}

