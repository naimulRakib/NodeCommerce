import { PrismaClient } from './src/generated/prisma';
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
});
async function main() {
  const upazillas = await prisma.upazillaReseller.findMany({ select: { id: true, email: true, upazilla: true, city: true } });
  const locals = await prisma.localReseller.findMany({ select: { id: true, email: true, upazilla: true, city: true } });
  console.log('Upazillas:', upazillas);
  console.log('Locals:', locals);
}
main().finally(() => prisma.$disconnect());
