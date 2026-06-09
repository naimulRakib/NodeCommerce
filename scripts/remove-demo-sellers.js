const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Removing demo sellers...");

  // Delete where id starts with "seller_user_"
  const result = await prisma.profile.deleteMany({
    where: {
      id: {
        startsWith: 'seller_user_'
      }
    }
  });

  console.log(`Removed ${result.count} demo sellers.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
