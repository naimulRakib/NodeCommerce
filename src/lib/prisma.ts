import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Bump when prisma/schema.prisma changes so dev hot-reload does not keep a stale client.
 */
const PRISMA_SCHEMA_VERSION = "2026-03-20-profile-fields";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaSchemaVersion: string | undefined;
}

const globalForPrisma = globalThis;

import { Pool } from 'pg';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

function getPrismaClient() {
  const stale =
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION;

  if (stale) {
    void globalForPrisma.prisma.$disconnect?.();
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
