import { prisma } from "../src/lib/prisma";

async function main() {
  const sellers = await prisma.profile.findMany({ select: { city: true, upazilla: true, sellerCode: true } });
  const upazillas = await prisma.upazillaReseller.findMany({ select: { city: true, upazilla: true, id: true } });
  const districts = await prisma.districtReseller.findMany({ select: { district: true, id: true } });
  const sellerProducts = await prisma.sellerProduct.findMany({
    select: {
      productCode: true,
      customName: true,
      status: true,
      stock: true,
      seller: { select: { city: true, upazilla: true } },
      globalProduct: { select: { name: true } },
    }
  });

  console.log("=== SELLERS ===", JSON.stringify(sellers, null, 2));
  console.log("=== UPAZILLA RESELLERS ===", JSON.stringify(upazillas, null, 2));
  console.log("=== DISTRICT RESELLERS ===", JSON.stringify(districts, null, 2));

  // Simulate the key matching the route does
  for (const sp of sellerProducts) {
    const name = sp.globalProduct?.name ?? sp.customName ?? "";
    const uKey = `${sp.seller.city.toLowerCase()}::${sp.seller.upazilla.toLowerCase()}`;
    const dKey = sp.seller.city.toLowerCase();
    const uMatch = upazillas.find(u => `${u.city.toLowerCase()}::${u.upazilla.toLowerCase()}` === uKey);
    const dMatch = districts.find(d => d.district.toLowerCase() === dKey);
    console.log(`\nProduct: ${sp.productCode} "${name}"`);
    console.log(`  seller.city="${sp.seller.city}" seller.upazilla="${sp.seller.upazilla}"`);
    console.log(`  uKey="${uKey}" → upazilla match: ${uMatch ? `✅ ${uMatch.id.slice(0,8)}` : "❌ NO MATCH"}`);
    console.log(`  dKey="${dKey}" → district match: ${dMatch ? `✅ ${dMatch.id.slice(0,8)}` : "❌ NO MATCH"}`);
    if (!uMatch) {
      console.log(`  Available upazilla keys: ${upazillas.map(u => `"${u.city.toLowerCase()}::${u.upazilla.toLowerCase()}"`).join(", ")}`);
    }
    if (!dMatch) {
      console.log(`  Available district keys: ${districts.map(d => `"${d.district.toLowerCase()}"`).join(", ")}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
