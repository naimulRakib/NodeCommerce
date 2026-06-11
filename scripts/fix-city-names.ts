/**
 * Fix: Normalise city name "Cumilla" → "Comilla" across all records
 * so ACO engine key matching works (seller.city == upazilla.city == district.district)
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🔧 Fixing city name inconsistency: Cumilla → Comilla\n");

  // 1. Fix seller profile city
  const sellerFix = await prisma.profile.updateMany({
    where: { city: "Cumilla" },
    data: { city: "Comilla" },
  });
  console.log(`✅ Profile.city fixed: ${sellerFix.count} rows`);

  // 2. Fix local reseller city
  const localFix = await prisma.localReseller.updateMany({
    where: { city: "Cumilla" },
    data: { city: "Comilla" },
  });
  console.log(`✅ LocalReseller.city fixed: ${localFix.count} rows`);

  // 3. Fix buyer profile city
  const buyerFix = await prisma.buyerProfile.updateMany({
    where: { city: "Cumilla" },
    data: { city: "Comilla" },
  });
  console.log(`✅ BuyerProfile.city fixed: ${buyerFix.count} rows`);

  // 4. Fix UpazillaDemand city (no city field — no action needed)
  // 5. Fix DistrictDemand (no city field — no action needed)

  // 6. Fix DemandPheromone entityName if it says Cumilla
  const pheroFix = await prisma.demandPheromone.updateMany({
    where: { entityName: "Cumilla" },
    data: { entityName: "Comilla" },
  });
  console.log(`✅ DemandPheromone.entityName fixed: ${pheroFix.count} rows`);

  // Also fix any ACO-related string fields
  // 7. Verify the state now
  const sellers = await prisma.profile.findMany({ select: { city: true, upazilla: true } });
  const upazillas = await prisma.upazillaReseller.findMany({ select: { city: true, upazilla: true } });
  const districts = await prisma.districtReseller.findMany({ select: { district: true } });
  
  console.log("\n=== VERIFICATION ===");
  console.log("Sellers:", JSON.stringify(sellers));
  console.log("Upazillas:", JSON.stringify(upazillas));
  console.log("Districts:", JSON.stringify(districts));

  // Check key match
  for (const s of sellers) {
    const uKey = `${s.city.toLowerCase()}::${s.upazilla.toLowerCase()}`;
    const dKey = s.city.toLowerCase();
    const uMatch = upazillas.some(u => `${u.city.toLowerCase()}::${u.upazilla.toLowerCase()}` === uKey);
    const dMatch = districts.some(d => d.district.toLowerCase() === dKey);
    console.log(`\n  seller city="${s.city}" upazilla="${s.upazilla}"`);
    console.log(`  uKey="${uKey}" → ${uMatch ? "✅ MATCHES upazilla" : "❌ STILL NO MATCH"}`);
    console.log(`  dKey="${dKey}" → ${dMatch ? "✅ MATCHES district" : "❌ STILL NO MATCH"}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
