import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const start = Date.now();
  console.log("Attempting connect via Prisma...");
  try {
    const res = await prisma.localReseller.findMany({ take: 1 });
    console.log("Success in", Date.now() - start, "ms", res);
  } catch (err) {
    console.error("Failed in", Date.now() - start, "ms", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
