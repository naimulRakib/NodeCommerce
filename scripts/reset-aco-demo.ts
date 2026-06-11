/**
 * Resets the ACO system state for a fresh demo run:
 * 1. Deletes all ACOShipment items, shipments, jobs, negotiations
 * 2. Resets seller stock back to original amounts
 * 3. Resets upazilla/district demand to unfulfilled
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🧹 Resetting ACO system for fresh demo...\n");

  // 1. Delete all ACO data
  await prisma.aCOShipmentItem.deleteMany({});
  console.log("  ✅ ACOShipmentItem cleared");
  
  await prisma.aCOShipment.deleteMany({});
  console.log("  ✅ ACOShipment cleared");

  await prisma.sellerACONegotiation.deleteMany({});
  console.log("  ✅ SellerACONegotiation cleared");
  
  await prisma.productDemandSnapshot.deleteMany({});
  console.log("  ✅ ProductDemandSnapshot cleared");
  
  await prisma.sellerSupplySnapshot.deleteMany({});
  console.log("  ✅ SellerSupplySnapshot cleared");

  await prisma.aCOGlobalJob.deleteMany({});
  console.log("  ✅ ACOGlobalJob cleared");

  // 2. Reset seller stock back to 1000
  const resetStock = await prisma.sellerProduct.updateMany({
    data: { stock: 1000 },
  });
  console.log(`\n  ✅ SellerProduct stock reset: ${resetStock.count} products → 1000 units each`);

  // 3. Reset upazilla demand to unfulfilled
  const resetUpDemand = await prisma.upazillaDemand.updateMany({
    data: {
      fulfilledQuantity: 0,
      status: "active",
    },
  });
  console.log(`  ✅ UpazillaDemand reset: ${resetUpDemand.count} demands → active/unfulfilled`);

  // 4. Reset district demand to unfulfilled
  // 4. Reset district demand to unfulfilled (remainingDemand = totalDemand)
  const distDemands = await prisma.districtDemand.findMany();
  for (const d of distDemands) {
    await prisma.districtDemand.update({
      where: { id: d.id },
      data: { remainingDemand: d.totalDemand, status: "active" },
    });
  }
  console.log(`  ✅ DistrictDemand reset: ${distDemands.length} demands → active/unfulfilled`);

  // 5. Fix seller profile (Supabase auth trigger creates empty profile)
  const sellerProfiles = await prisma.profile.findMany({ where: { type: "seller" } });
  for (const p of sellerProfiles) {
    if (!p.city || !p.upazilla || p.lat === 0) {
      await prisma.profile.update({
        where: { id: p.id },
        data: {
          city: "Comilla",
          upazilla: "Burichang",
          storeName: "বুড়িচং ফ্রেশ ফার্ম",
          lat: 23.526,
          lng: 91.154,
        },
      });
      console.log(`  ✅ Seller profile fixed: ${p.id.slice(0,8)}... → Comilla/Burichang`);
    }
  }

  // 5. Verify
  const products = await prisma.sellerProduct.findMany({ select: { customName: true, stock: true, globalProduct: { select: { name: true } } } });
  const upDemands = await prisma.upazillaDemand.findMany({ select: { productName: true, demandQuantity: true, fulfilledQuantity: true, status: true } });
  const distDemands2 = await prisma.districtDemand.findMany({ select: { productName: true, totalDemand: true, remainingDemand: true, status: true } });

  console.log("\n=== VERIFICATION ===");
  console.log("Products:", JSON.stringify(products, null, 2));
  console.log("Upazilla Demands:", JSON.stringify(upDemands, null, 2));
  console.log("District Demands:", JSON.stringify(distDemands2, null, 2));

  console.log("\n✅ Ready for a fresh ACO demo run!");
}

main().catch(console.error).finally(() => process.exit(0));
