// @ts-nocheck
/**
 * seed-multi-product-demand.ts
 * ----------------------------
 * Seeds UpazillaDemand and DistrictDemand across several
 * districts and products so the global ACO trigger has
 * realistic multi-product deficits to route against.
 *
 * Run with: npx tsx scripts/seed-multi-product-demand.ts
 * (or via `npm run seed:multi-product` once added).
 */
import { PrismaClient } from "@/generated/prisma";
const prisma = new PrismaClient();

const TARGET_DISTRICTS = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi"];
const TARGET_PRODUCTS = [
  "Basmati Rice",
  "Soybean Oil",
  "Toilet Soap",
  "LED Bulb",
  "Paracetamol",
];

async function main() {
  console.log("🌱 Seeding multi-product demands…");

  // Find or create the local test profile for demand authorship.
  const profile = await prisma.profile.findFirst({
    where: { type: "upazillaReseller" },
  });
  if (!profile) {
    console.error("❌ No upazilla_reseller profile found. Run seed.ts first.");
    process.exit(1);
  }

  for (const district of TARGET_DISTRICTS) {
    for (const product of TARGET_PRODUCTS) {
      const p = await prisma.product.findFirst({
        where: { name: { equals: product, mode: "insensitive" } },
      });
      if (!p) {
        console.log(`  ⚠ product ${product} not found, skipping`);
        continue;
      }
      // Create an upazilla demand for this district/product
      await prisma.upazillaDemand.upsert({
        where: { id: `seed-${district}-${product}` },
        create: {
          id: `seed-${district}-${product}`,
          productId: p.id,
          district,
          upazilla: "default",
          quantity: 50 + Math.floor(Math.random() * 100),
          fulfilledQuantity: 0,
          status: "pending",
          requesterId: profile.id,
        },
        update: {
          quantity: 50 + Math.floor(Math.random() * 100),
          status: "pending",
        },
      });
      // And a district-level demand (for Phase 2/3 cross-district)
      await prisma.districtDemand.upsert({
        where: { id: `seed-dist-${district}-${product}` },
        create: {
          id: `seed-dist-${district}-${product}`,
          productId: p.id,
          district,
          quantity: 80 + Math.floor(Math.random() * 200),
          fulfilledQuantity: 0,
          status: "pending",
          requesterId: profile.id,
        },
        update: {
          quantity: 80 + Math.floor(Math.random() * 200),
          status: "pending",
        },
      });
      console.log(`  ✓ ${district} / ${product}: 50-150 units`);
    }
  }

  console.log("✅ Multi-product demand seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
