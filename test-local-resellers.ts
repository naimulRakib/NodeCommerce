import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  const resellers = await prisma.localReseller.findMany();
  console.log("Found local resellers:", resellers.length);
  if (resellers.length > 0) {
    console.log(resellers.map(r => ({id: r.id, city: r.city, lat: r.lat, lng: r.lng})));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
