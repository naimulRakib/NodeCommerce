import { prisma } from "../src/lib/prisma";

async function main() {
  const productScope = ["Premium Miniket Rice (50kg)", "Mechanical Gaming Keyboard"];
  
  // 1. Check seller products with stock > 0
  const sellerProducts = await prisma.sellerProduct.findMany({
    where: {
      status: "approved",
      stock: { gt: 0 },
      OR: [
        { globalProduct: { name: { in: productScope, mode: "insensitive" } } },
        { customName: { in: productScope, mode: "insensitive" } },
      ],
    },
    include: {
      seller: { select: { id: true, city: true, upazilla: true, storeName: true, lat: true, lng: true } },
      globalProduct: { select: { name: true } },
    },
  });
  console.log("\n=== SELLER PRODUCTS ===");
  console.log(JSON.stringify(sellerProducts, null, 2));

  // 2. Check upazilla demands
  const upazillaDemandsRaw = await prisma.upazillaDemand.findMany({
    where: {
      productName: { in: productScope, mode: "insensitive" },
    },
    include: {
      upazillaReseller: {
        select: {
          id: true,
          upazilla: true,
          city: true,
        },
      },
    },
  });
  console.log("\n=== UPAZILLA DEMANDS RAW ===");
  console.log(JSON.stringify(upazillaDemandsRaw, null, 2));

  // 3. Check pending demand
  const demands = upazillaDemandsRaw.map(d => ({
    product: d.productName,
    demand: d.demandQuantity,
    fulfilled: d.fulfilledQuantity,
    pending: d.demandQuantity - d.fulfilledQuantity,
    upazillaResellerId: d.upazillaResellerId,
    city: d.upazillaReseller.city,
    upazilla: d.upazillaReseller.upazilla,
  }));
  console.log("\n=== DEMAND ANALYSIS ===");
  console.log(JSON.stringify(demands, null, 2));

  // 4. Check upazilla reseller matching
  const upazillaResellerRows = await prisma.upazillaReseller.findMany({
    select: { id: true, upazilla: true, city: true },
  });
  console.log("\n=== UPAZILLA RESELLERS ===");
  console.log(JSON.stringify(upazillaResellerRows, null, 2));

  // 5. Check district reseller matching
  const districtResellerRows = await prisma.districtReseller.findMany({
    select: { id: true, district: true },
  });
  console.log("\n=== DISTRICT RESELLERS ===");
  console.log(JSON.stringify(districtResellerRows, null, 2));

  // 6. Simulate supply building
  const upazillaIdByName = new Map();
  for (const u of upazillaResellerRows) {
    upazillaIdByName.set(`${u.city.toLowerCase()}::${u.upazilla.toLowerCase()}`, { id: u.id });
  }
  const districtIdByName = new Map();
  for (const d of districtResellerRows) {
    districtIdByName.set(d.district.toLowerCase(), { id: d.id });
  }

  console.log("\n=== SUPPLY BUILDING ===");
  for (const sp of sellerProducts) {
    const uKey = `${sp.seller.city.toLowerCase()}::${sp.seller.upazilla.toLowerCase()}`;
    const dKey = sp.seller.city.toLowerCase();
    const ownU = upazillaIdByName.get(uKey);
    const hubD = districtIdByName.get(dKey);
    console.log(`Product: ${sp.globalProduct?.name ?? sp.customName}`);
    console.log(`  seller: city=${sp.seller.city}, upazilla=${sp.seller.upazilla}`);
    console.log(`  uKey="${uKey}" → match: ${ownU ? "✅ " + ownU.id.slice(0,8) : "❌ NONE"}`);
    console.log(`  dKey="${dKey}" → match: ${hubD ? "✅ " + hubD.id.slice(0,8) : "❌ NONE"}`);
    console.log(`  stock: ${sp.stock}`);

    // Phase 1 simulation
    if (ownU) {
      const matching = upazillaDemandsRaw.filter(
        d => d.upazillaResellerId === ownU.id &&
          d.productName.toLowerCase() === (sp.globalProduct?.name ?? sp.customName ?? "").toLowerCase()
      );
      console.log(`  Phase1 matching demands: ${matching.length}`);
      for (const m of matching) {
        const pending = m.demandQuantity - m.fulfilledQuantity;
        console.log(`    → "${m.productName}" demand=${m.demandQuantity} fulfilled=${m.fulfilledQuantity} pending=${pending}`);
        console.log(`    → district check: demand.city="${m.upazillaReseller.city}" vs supply.district="${sp.seller.city}" → ${m.upazillaReseller.city.toLowerCase() === sp.seller.city.toLowerCase() ? "✅ MATCH" : "❌ MISMATCH"}`);
      }
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
