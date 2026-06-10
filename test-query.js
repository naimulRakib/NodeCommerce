const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();
async function main() {
  const ships = await prisma.aCOShipment.findMany({ where: { phase: 3 } });
  console.log(JSON.stringify(ships, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
