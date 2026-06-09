import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log("1. Resetting Seller Product Stock to random healthy levels...");
  const sellerProducts = await prisma.sellerProduct.findMany({
    where: { status: 'approved' }
  });

  for (const sp of sellerProducts) {
    const randomStock = Math.floor(Math.random() * 4000) + 1000; // 1000 - 5000 units
    await prisma.sellerProduct.update({
      where: { id: sp.id },
      data: { stock: randomStock }
    });
  }
  console.log(`✅ Set stock for ${sellerProducts.length} approved products.\n`);

  console.log("2. Running Full Supply Chain Reset...");
  const resetRes = await fetch('http://localhost:3000/api/supply-chain/full-reset', {
    method: 'POST',
    headers: { 'X-Internal-Secret': 'dev-secret' }
  });
  const resetData = await resetRes.json();
  console.log(`✅ Reset complete: ${resetData.totalDeleted} records wiped.\n`);

  console.log("3. Seeding Cascading Demands (Local -> Upazilla -> District)...");
  const seedRes = await fetch('http://localhost:3000/api/supply-chain/seed-demands', {
    method: 'POST',
    headers: { 'X-Internal-Secret': 'dev-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ minQty: 10, maxQty: 100, productsPerReseller: 0 })
  });
  const seedData = await seedRes.json();
  console.log("✅ Seed complete:");
  console.log(`   - Local demands created: ${seedData.localDemandsCreated}`);
  console.log(`   - Upazilla demands created: ${seedData.upazillaDemandsCreated}`);
  console.log(`   - District demands created: ${seedData.districtDemandsCreated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
