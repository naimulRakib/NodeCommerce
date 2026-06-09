import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { prisma } from "./src/lib/prisma";

async function seedDemand() {
  console.log("Seeding random demand for ALL districts...");

  const products = await prisma.sellerProduct.findMany({
    where: { status: "approved" },
    include: { globalProduct: true }
  });

  const localResellers = await prisma.localReseller.findMany();
  const upazillaResellers = await prisma.upazillaReseller.findMany();
  const districtResellers = await prisma.districtReseller.findMany();

  if (products.length === 0 || localResellers.length === 0) {
    console.error("No products or local resellers found. Run seed.ts first.");
    return;
  }

  // Get unique product names available globally
  const uniqueProductNames = [
    ...new Set(products.map(p => p.customName || p.globalProduct?.name || ""))
  ].filter(Boolean);

  console.log(`Found ${localResellers.length} local resellers, ${upazillaResellers.length} upazilla resellers, ${uniqueProductNames.length} unique products`);

  // Clear existing demands
  await prisma.localDemand.deleteMany();
  await prisma.upazillaDemand.deleteMany();
  await prisma.districtDemand.deleteMany();

  // Track aggregation: (upazillaId -> productName -> qty) and (districtName -> productName -> qty)
  const upazillaAgg = new Map<string, Map<string, number>>();
  const districtAgg = new Map<string, Map<string, number>>();

  // Seed local demand — every local reseller demands 2-4 random products
  for (const local of localResellers) {
    const shuffled = [...uniqueProductNames].sort(() => 0.5 - Math.random());
    const selectedProducts = shuffled.slice(0, Math.floor(Math.random() * 3) + 2);

    for (const prodName of selectedProducts) {
      // Dhaka gets higher demand to force inter-district routing
      const isDhaka = local.city === "Dhaka";
      const qty = isDhaka
        ? Math.floor(Math.random() * 200) + 100  // 100-300 for Dhaka
        : Math.floor(Math.random() * 50) + 10;   // 10-60 for Comilla

      // Find product code
      const prod = products.find(p => (p.customName || p.globalProduct?.name) === prodName);
      if (!prod) continue;

      await prisma.localDemand.create({
        data: {
          localResellerId: local.id,
          productCode: prod.productCode,
          productName: prodName,
          demandQuantity: qty,
          status: "pending"
        }
      });
      console.log(`  📍 ${local.username} (${local.city}/${local.upazilla}) → ${qty} ${prodName}`);

      // Aggregate upazilla demand
      // Find the upazilla reseller for this local reseller's upazilla
      const upa = upazillaResellers.find(u => u.city === local.city && u.upazilla === local.upazilla);
      if (upa) {
        if (!upazillaAgg.has(upa.id)) upazillaAgg.set(upa.id, new Map());
        const cur = upazillaAgg.get(upa.id)!.get(prodName) ?? 0;
        upazillaAgg.get(upa.id)!.set(prodName, cur + qty);
      }

      // Aggregate district demand
      const distKey = local.city;
      if (!districtAgg.has(distKey)) districtAgg.set(distKey, new Map());
      const distCur = districtAgg.get(distKey)!.get(prodName) ?? 0;
      districtAgg.get(distKey)!.set(prodName, distCur + qty);
    }
  }

  // Create Upazilla-level demand
  for (const [upaId, productMap] of upazillaAgg.entries()) {
    const upa = upazillaResellers.find(u => u.id === upaId)!;
    for (const [productName, qty] of productMap.entries()) {
      await prisma.upazillaDemand.create({
        data: {
          upazillaResellerId: upaId,
          productName,
          demandQuantity: qty,
          status: "pending",
          enteredBy: upaId
        }
      });
      console.log(`  🏢 ${upa.upazilla} Upazilla (${upa.city}) → ${qty} ${productName}`);
    }
  }

  // Create District-level demand
  for (const [districtName, productMap] of districtAgg.entries()) {
    const dist = districtResellers.find(d => d.district === districtName);
    if (!dist) {
      console.warn(`  ⚠️  No district reseller found for ${districtName} — skipping district demand`);
      continue;
    }
    for (const [productName, qty] of productMap.entries()) {
      await prisma.districtDemand.create({
        data: {
          districtResellerId: dist.id,
          productName,
          totalDemand: qty,
          remainingDemand: qty,
          status: "pending"
        }
      });
      console.log(`  🏙️  ${districtName} District → ${qty} ${productName}`);
    }
  }

  console.log("\n✅ Multi-district demand seeded successfully!");
  console.log("   Comilla: moderate demand (10–60 units/product)");
  console.log("   Dhaka:   high demand (100–300 units/product) — will trigger Phase 3 from Comilla surplus");
}

seedDemand()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
