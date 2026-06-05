import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const locals = await prisma.localReseller.findMany();
  console.log("Local Resellers in DB:");
  locals.forEach((l: any) => console.log(`ID: ${l.id}, Email: ${l.email}, Username: ${l.username}`));
  
  const upazillas = await prisma.upazillaReseller.findMany();
  console.log("\nUpazilla Resellers in DB:");
  upazillas.forEach((u: any) => console.log(`ID: ${u.id}, Email: ${u.email}`));
}
test().finally(() => prisma.$disconnect());
