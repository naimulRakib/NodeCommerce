import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Resetting all ACO data...");

  // Delete all ACO models in order
  console.log("Deleting ACOShipmentItems...");
  await prisma.aCOShipmentItem.deleteMany({});
  
  console.log("Deleting ACOShipments...");
  await prisma.aCOShipment.deleteMany({});
  
  console.log("Deleting SellerSupplySnapshots...");
  await prisma.sellerSupplySnapshot.deleteMany({});
  
  console.log("Deleting ACOGlobalJobs...");
  await prisma.aCOGlobalJob.deleteMany({});

  console.log("\n✅ All ACO data has been deleted.");
  console.log("⚠️  Please run `npx tsx seed-demand.ts` to re-seed demand requirements before triggering the ACO pipeline again.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
