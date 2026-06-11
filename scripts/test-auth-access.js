const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$queryRawUnsafe('SELECT count(*) FROM auth.users');
    console.log("Auth users count:", res);
  } catch (e) {
    console.error("Auth error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
