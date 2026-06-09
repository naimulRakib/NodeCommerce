const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function randomCoord(min, max) {
  return Math.random() * (max - min) + min;
}

async function main() {
  console.log("Seeding data for SuperDashboard checks...");

  // Create 200 random sellers
  console.log("Seeding 200 sellers...");
  for(let i=0; i<200; i++) {
    const sellerCode = `SEL${i.toString().padStart(4, '0')}`;
    try {
      await prisma.profile.upsert({
        where: { sellerCode: sellerCode },
        update: {
          lat: randomCoord(21.0, 26.0),
          lng: randomCoord(88.5, 92.0),
        },
        create: {
          id: `seller_user_${i}`,
          username: `seller_${i}`,
          type: 'seller',
          storeName: `Random Store ${i}`,
          lat: randomCoord(21.0, 26.0),
          lng: randomCoord(88.5, 92.0),
          city: 'Random City',
          upazilla: 'Random Upazilla',
          sellerCode: sellerCode
        }
      });
    } catch (err) {
      console.log(`Skipping seller ${i} due to error`);
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
