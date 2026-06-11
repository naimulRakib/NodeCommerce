/**
 * NodeCommerce Bangladesh — Hackathon Demo Seed Script
 * =====================================================
 * Creates a complete supply chain for Cumilla District / Burichang Upazilla.
 *
 * Topology:
 *   DistrictReseller (Cumilla)
 *     └── UpazillaReseller (Burichang)
 *           ├── LocalReseller (Burichang)
 *           ├── Seller (Burichang) ← has stock
 *           └── Buyer (Burichang)
 *
 * Products: Premium Miniket Rice (50kg) | Mechanical Gaming Keyboard
 * Password: password123 for ALL accounts
 *
 * Real lat/lng centroids:
 *   Cumilla District:   23.4607° N, 91.1809° E
 *   Burichang Upazilla: 23.5290° N, 91.1560° E
 */

import { prisma } from "../src/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const PASSWORD = "password123";

// ─── Lat/Lng Coordinates ───────────────────────────────────────────────────
const COORDS = {
  cumilla_district: { lat: 23.4607, lng: 91.1809 },       // Cumilla city center
  burichang_upazilla: { lat: 23.5290, lng: 91.1560 },      // Burichang upazilla HQ
  burichang_local: { lat: 23.5312, lng: 91.1578 },         // Local reseller shop
  burichang_seller: { lat: 23.5268, lng: 91.1542 },        // Seller warehouse
  burichang_buyer: { lat: 23.5301, lng: 91.1591 },         // Buyer home
};

// ─── Helpers ───────────────────────────────────────────────────────────────
async function wipe() {
  console.log("\n🗑️  Wiping all public tables...");
  const tablenames = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';`
  );
  const tables = tablenames.map(({ tablename }) => `"${tablename}"`).join(", ");
  if (tables) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  console.log("✅ Public tables wiped.\n");

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM auth.users CASCADE;`);
    console.log("✅ auth.users wiped.\n");
  } catch (e: any) {
    console.warn("⚠️  Could not wipe auth.users:", e.message);
  }
}

async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await supabase.auth.signUp({ email, password: PASSWORD });
  if (error || !data.user) {
    console.log(`  ↩ Already exists or signup failed for ${email}: ${error?.message}`);
    const login = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
    if (login.data.user) return login.data.user.id;
    throw new Error(`Cannot get user id for ${email}: ${error?.message}`);
  }
  return data.user.id;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 NodeCommerce Hackathon Seed — Cumilla / Burichang\n");
  await wipe();

  // ────────────────────────────────────────────────────────────────────────
  // 1. DISTRICT RESELLER — Cumilla
  // ────────────────────────────────────────────────────────────────────────
  console.log("1️⃣  Creating District Reseller (Cumilla)...");
  const districtEmail = "district.cumilla@demo.com";
  const districtId = await createAuthUser(districtEmail);
  await prisma.districtReseller.create({
    data: {
      id: districtId,
      email: districtEmail,
      district: "Comilla",
      lat: COORDS.cumilla_district.lat,
      lng: COORDS.cumilla_district.lng,
    },
  });
  console.log(`   ✅ district.cumilla@demo.com  ID: ${districtId.slice(0, 8)}...`);

  // ────────────────────────────────────────────────────────────────────────
  // 2. UPAZILLA RESELLER — Burichang
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Creating Upazilla Reseller (Burichang, Cumilla)...");
  const upazillaEmail = "upazilla.burichang@demo.com";
  const upazillaId = await createAuthUser(upazillaEmail);
  await prisma.upazillaReseller.create({
    data: {
      id: upazillaId,
      email: upazillaEmail,
      city: "Comilla",
      upazilla: "Burichang",
      lat: COORDS.burichang_upazilla.lat,
      lng: COORDS.burichang_upazilla.lng,
    },
  });
  console.log(`   ✅ upazilla.burichang@demo.com  ID: ${upazillaId.slice(0, 8)}...`);

  // ────────────────────────────────────────────────────────────────────────
  // 3. LOCAL RESELLER — Burichang
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Creating Local Reseller (Burichang)...");
  const localEmail = "local.burichang@demo.com";
  const localId = await createAuthUser(localEmail);
  await prisma.localReseller.create({
    data: {
      id: localId,
      email: localEmail,
      username: "বুড়িচং লোকাল হাব",
      fullName: "Karim Uddin",
      phone: "01712345678",
      city: "Comilla",
      upazilla: "Burichang",
      resellerCode: "BRC-LC1",
      lat: COORDS.burichang_local.lat,
      lng: COORDS.burichang_local.lng,
    },
  });
  console.log(`   ✅ local.burichang@demo.com  ID: ${localId.slice(0, 8)}...`);

  // ────────────────────────────────────────────────────────────────────────
  // 4. SELLER — Burichang (has stock)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Creating Seller (Burichang)...");
  const sellerEmail = "seller.burichang@demo.com";
  const sellerId = await createAuthUser(sellerEmail);
  await prisma.profile.upsert({
    where: { id: sellerId },
    create: {
      id: sellerId,
      type: "seller",
      username: "burichang_fresh",
      storeName: "বুড়িচং ফ্রেশ ফার্ম",
      fullName: "Hasan Ali",
      phone: "01812345678",
      city: "Comilla",
      upazilla: "Burichang",
      sellerCode: "SEL-BRC1",
      lat: COORDS.burichang_seller.lat,
      lng: COORDS.burichang_seller.lng,
    },
    update: {
      type: "seller",
      username: "burichang_fresh",
      storeName: "বুড়িচং ফ্রেশ ফার্ম",
      fullName: "Hasan Ali",
      phone: "01812345678",
      city: "Comilla",
      upazilla: "Burichang",
      sellerCode: "SEL-BRC1",
      lat: COORDS.burichang_seller.lat,
      lng: COORDS.burichang_seller.lng,
    },
  });
  console.log(`   ✅ seller.burichang@demo.com  ID: ${sellerId.slice(0, 8)}...`);

  // ────────────────────────────────────────────────────────────────────────
  // 5. BUYER — Burichang
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Creating Buyer (Burichang)...");
  const buyerEmail = "buyer.burichang@demo.com";
  const buyerId = await createAuthUser(buyerEmail);
  await prisma.buyerProfile.create({
    data: {
      id: buyerId,
      email: buyerEmail,
      fullName: "Fatema Begum",
      phone: "01912345678",
      address: "বুড়িচং বাজার রোড, কুমিল্লা",
      city: "Comilla",
      upazilla: "Burichang",
      district: "Comilla",
      lat: COORDS.burichang_buyer.lat,
      lng: COORDS.burichang_buyer.lng,
    },
  });
  console.log(`   ✅ buyer.burichang@demo.com  ID: ${buyerId.slice(0, 8)}...`);

  // ────────────────────────────────────────────────────────────────────────
  // 6. GLOBAL PRODUCTS
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Creating Global Products...");

  const rice = await prisma.globalProduct.create({
    data: {
      name: "Premium Miniket Rice (50kg)",
      brand: "Fresh Farm",
      category: "Groceries",
      subCategory: "Rice",
      description: "উচ্চমানের প্রিমিয়াম মিনিকেট চাল। সরাসরি ফার্ম থেকে আনা। ৫০ কেজি বস্তা।",
      imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=60",
      tags: ["rice", "miniket", "groceries", "food", "premium"],
    },
  });

  const keyboard = await prisma.globalProduct.create({
    data: {
      name: "Mechanical Gaming Keyboard",
      brand: "TechPro BD",
      category: "Electronics",
      subCategory: "Peripherals",
      description: "RGB Mechanical Gaming Keyboard with Blue Switches. বাংলাদেশে অফিসিয়াল ওয়ারেন্টি সহ।",
      imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=60",
      tags: ["keyboard", "gaming", "mechanical", "rgb", "electronics"],
    },
  });

  console.log("   ✅ Premium Miniket Rice (50kg)");
  console.log("   ✅ Mechanical Gaming Keyboard");

  // ────────────────────────────────────────────────────────────────────────
  // 7. SELLER PRODUCTS (inventory with stock + approved status)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Creating Seller inventory...");

  const riceProduct = await prisma.sellerProduct.create({
    data: {
      sellerId,
      globalProductId: rice.id,
      customName: "প্রিমিয়াম মিনিকেট চাল (৫০কেজি)",
      price: 3200,
      stock: 1000,      // 1000 units available
      status: "approved",
      productCode: "RICE-BRC-001",
    },
  });

  const keyboardProduct = await prisma.sellerProduct.create({
    data: {
      sellerId,
      globalProductId: keyboard.id,
      customName: "মেকানিক্যাল গেমিং কীবোর্ড",
      price: 2800,
      stock: 80,        // 80 units available
      status: "approved",
      productCode: "KEYB-BRC-001",
    },
  });

  console.log(`   ✅ Rice: 1,000 units @ ৳3,200 each (productCode: RICE-BRC-001)`);
  console.log(`   ✅ Keyboard: 80 units @ ৳2,800 each (productCode: KEYB-BRC-001)`);

  // ────────────────────────────────────────────────────────────────────────
  // 8. UPAZILLA DEMAND (what Burichang needs — triggers ACO)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Creating Upazilla Demands (Burichang needs stock)...");

  await prisma.upazillaDemand.create({
    data: {
      upazillaResellerId: upazillaId,
      productName: "Premium Miniket Rice (50kg)",
      demandQuantity: 500,   // needs 500 units of rice
      fulfilledQuantity: 0,
      status: "pending",
      enteredBy: upazillaId,
      notes: "রমজান মাসের আগে চাহিদা বেশি। ৫০০ বস্তা চাল দরকার জরুরি।",
    },
  });

  await prisma.upazillaDemand.create({
    data: {
      upazillaResellerId: upazillaId,
      productName: "Mechanical Gaming Keyboard",
      demandQuantity: 30,    // needs 30 keyboards
      fulfilledQuantity: 0,
      status: "pending",
      enteredBy: upazillaId,
      notes: "শিক্ষার্থী ও অফিসের চাহিদায় ৩০টি কীবোর্ড প্রয়োজন।",
    },
  });

  console.log("   ✅ Rice demand: 500 units (pending)");
  console.log("   ✅ Keyboard demand: 30 units (pending)");

  // ────────────────────────────────────────────────────────────────────────
  // 9. DISTRICT DEMAND (cumilla district aggregate)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n9️⃣  Creating District Demands (Cumilla aggregate)...");

  await prisma.districtDemand.create({
    data: {
      districtResellerId: districtId,
      productName: "Premium Miniket Rice (50kg)",
      totalDemand: 500,
      remainingDemand: 500,
      status: "pending",
    },
  });

  await prisma.districtDemand.create({
    data: {
      districtResellerId: districtId,
      productName: "Mechanical Gaming Keyboard",
      totalDemand: 30,
      remainingDemand: 30,
      status: "pending",
    },
  });

  console.log("   ✅ Comilla District demands created (rice: 500, keyboard: 30)");

  // ────────────────────────────────────────────────────────────────────────
  // 10. LOCAL DEMAND (what local reseller needs from upazilla)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n🔟  Creating Local Reseller Demands...");

  await prisma.localDemand.create({
    data: {
      localResellerId: localId,
      productCode: riceProduct.productCode,
      productName: "Premium Miniket Rice (50kg)",
      demandQuantity: 200,  // local needs 200 from upazilla
      fulfilledQuantity: 0,
      status: "pending",
    },
  });

  await prisma.localDemand.create({
    data: {
      localResellerId: localId,
      productCode: keyboardProduct.productCode,
      productName: "Mechanical Gaming Keyboard",
      demandQuantity: 15,
      fulfilledQuantity: 0,
      status: "pending",
    },
  });

  console.log("   ✅ Local demands: Rice 200 units, Keyboard 15 units");

  // ────────────────────────────────────────────────────────────────────────
  // 11. PHEROMONE SEEDS (so ACO sees existing demand signal)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣1️⃣  Seeding ACO Pheromone signals...");

  await prisma.demandPheromone.createMany({
    data: [
      {
        entityType: "upazilla",
        entityId: upazillaId,
        entityName: "Burichang",
        productName: "Premium Miniket Rice (50kg)",
        score: 4.5,          // high pheromone → ACO strongly attracted
        demandDeficit: 500,
        waitingDays: 2,
      },
      {
        entityType: "upazilla",
        entityId: upazillaId,
        entityName: "Burichang",
        productName: "Mechanical Gaming Keyboard",
        score: 2.8,
        demandDeficit: 30,
        waitingDays: 1,
      },
      {
        entityType: "district",
        entityId: districtId,
        entityName: "Cumilla",
        productName: "Premium Miniket Rice (50kg)",
        score: 5.0,
        demandDeficit: 500,
        waitingDays: 2,
      },
    ],
    skipDuplicates: true,
  });

  console.log("   ✅ Pheromone trails seeded for ACO pathfinding");

  // ────────────────────────────────────────────────────────────────────────
  // 12. BUYER BEHAVIOUR (search history to trigger AI analysis)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣2️⃣  Seeding Buyer behaviour data (search spikes)...");

  await prisma.buyerBehaviour.createMany({
    data: [
      { buyerId, type: "search", payload: { query: "miniket rice", results: 3 } },
      { buyerId, type: "search", payload: { query: "premium rice 50kg", results: 2 } },
      { buyerId, type: "view", payload: { productCode: "RICE-BRC-001", timeSpent: 45 } },
      { buyerId, type: "search", payload: { query: "mechanical keyboard", results: 5 } },
      { buyerId, type: "view", payload: { productCode: "KEYB-BRC-001", timeSpent: 120 } },
      { buyerId, type: "cart_add", payload: { productCode: "RICE-BRC-001", quantity: 2 } },
    ],
  });

  console.log("   ✅ 6 buyer behaviour events seeded");

  // ────────────────────────────────────────────────────────────────────────
  // DONE
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("🎉  HACKATHON DEMO DATA READY!");
  console.log("=".repeat(60));
  console.log("\n📧 ACCOUNT CREDENTIALS (all use password: password123)\n");
  console.log("  Role              Email                          ");
  console.log("  ────────────────────────────────────────────────");
  console.log("  District Reseller  district.cumilla@demo.com    ");
  console.log("  Upazilla Reseller  upazilla.burichang@demo.com  ");
  console.log("  Local Reseller     local.burichang@demo.com     ");
  console.log("  Seller             seller.burichang@demo.com    ");
  console.log("  Buyer              buyer.burichang@demo.com     ");
  console.log("\n  Password: password123");
  console.log("\n📦 PRODUCTS:");
  console.log("  • Premium Miniket Rice (50kg) — code: RICE-BRC-001  stock: 1,000  price: ৳3,200");
  console.log("  • Mechanical Gaming Keyboard  — code: KEYB-BRC-001  stock: 80     price: ৳2,800");
  console.log("\n📍 LOCATION: Burichang Upazilla, Cumilla District");
  console.log("  Lat: 23.5290 / Lng: 91.1560\n");
}

main().catch(console.error).finally(() => process.exit(0));
