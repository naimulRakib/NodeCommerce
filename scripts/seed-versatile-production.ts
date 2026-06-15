import { prisma } from '../src/lib/prisma';
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

// ---------------------------------------------------------
// Helper: Create User in Supabase
// ---------------------------------------------------------
async function signUpAndGetId(email: string, password: string = "password123"): Promise<string | null> {
  // 1. Check if user already exists in auth.users
  const existingUsers = await prisma.$queryRaw<{id: string}[]>`SELECT id FROM auth.users WHERE email = ${email}`;
  if (existingUsers && existingUsers.length > 0) {
    return existingUsers[0].id;
  }

  // 2. Otherwise create via REST API
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.msg?.includes("User already registered")) {
       // Since they exist in Supabase but not Prisma, we'll try to sign in to get their ID
       const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY! },
         body: JSON.stringify({ email, password })
       });
       const loginData = await loginRes.json();
       if (loginData.user?.id) return loginData.user.id;
    }
    console.error(`Failed to create ${email}:`, data);
    return null;
  }
  
  return data.user?.id || data.id;
}

// ---------------------------------------------------------
// Topology Data
// ---------------------------------------------------------
const DISTRICTS = [
  { name: "Dhaka", email: "district.dhaka@demo.com", lat: 23.8103, lng: 90.4125 },
  { name: "Cumilla", email: "district.cumilla@demo.com", lat: 23.4607, lng: 91.1809 },
];

const UPAZILLAS = [
  { name: "Mirpur", district: "Dhaka", email: "upazilla.mirpur@demo.com", lat: 23.8223, lng: 90.3654 },
  { name: "Uttara", district: "Dhaka", email: "upazilla.uttara@demo.com", lat: 23.8759, lng: 90.3975 },
  { name: "Burichang", district: "Cumilla", email: "upazilla.burichang@demo.com", lat: 23.5500, lng: 91.1300 },
  { name: "Daudkandi", district: "Cumilla", email: "upazilla.daudkandi@demo.com", lat: 23.5333, lng: 90.7167 },
];

const LOCAL_RESELLERS = [
  { name: "Mirpur Local 1", upazilla: "Mirpur", email: "local.mirpur1@demo.com", lat: 23.8150, lng: 90.3600 },
  { name: "Mirpur Local 2", upazilla: "Mirpur", email: "local.mirpur2@demo.com", lat: 23.8300, lng: 90.3700 },
  { name: "Uttara Local 1", upazilla: "Uttara", email: "local.uttara1@demo.com", lat: 23.8700, lng: 90.3900 },
  { name: "Uttara Local 2", upazilla: "Uttara", email: "local.uttara2@demo.com", lat: 23.8800, lng: 90.4000 },
  { name: "Burichang Local 1", upazilla: "Burichang", email: "local.burichang1@demo.com", lat: 23.5400, lng: 91.1200 },
  { name: "Burichang Local 2", upazilla: "Burichang", email: "local.burichang2@demo.com", lat: 23.5600, lng: 91.1400 },
  { name: "Daudkandi Local 1", upazilla: "Daudkandi", email: "local.daudkandi1@demo.com", lat: 23.5200, lng: 90.7000 },
  { name: "Daudkandi Local 2", upazilla: "Daudkandi", email: "local.daudkandi2@demo.com", lat: 23.5400, lng: 90.7300 },
];

const SELLERS = [
  { name: "Dhaka Mega Seller", email: "seller.dhaka@demo.com", city: "Dhaka", upazilla: "Uttara", lat: 23.8800, lng: 90.4100 },
  { name: "Cumilla Agro", email: "seller.cumilla@demo.com", city: "Cumilla", upazilla: "Burichang", lat: 23.5650, lng: 91.1500 },
  { name: "National Electronics", email: "seller.national@demo.com", city: "Dhaka", upazilla: "Mirpur", lat: 23.8000, lng: 90.3500 },
  { name: "Daudkandi Suppliers", email: "seller.daudkandi@demo.com", city: "Cumilla", upazilla: "Daudkandi", lat: 23.5500, lng: 90.7400 },
];

const BUYERS = [
  { name: "Buyer Dhaka", email: "buyer.dhaka@demo.com" },
  { name: "Buyer Cumilla", email: "buyer.cumilla@demo.com" }
];

async function main() {
  console.log("🚀 Starting Versatile Production Seed...\n");

  console.log("🧹 Wiping public tables for a clean slate...");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "profiles" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "global_products" CASCADE;`);
  console.log("✅ Database wiped.");

  // 1. Create District Resellers
  console.log("\n🏢 Provisioning District Resellers...");
  for (const d of DISTRICTS) {
    const id = await signUpAndGetId(d.email);
    if (!id) continue;
    await prisma.profile.upsert({
      where: { id },
      update: {
        type: "district_reseller",
        fullName: d.name + " Hub", city: d.name, upazilla: "City Center",
        username: d.name.toLowerCase().replace(/\s/g, ''),
        storeName: d.name + " Hub",
        lat: d.lat, lng: d.lng
      },
      create: {
        id, type: "district_reseller",
        fullName: d.name + " Hub", city: d.name, upazilla: "City Center",
        username: d.name.toLowerCase().replace(/\s/g, ''),
        storeName: d.name + " Hub",
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: d.lat, lng: d.lng
      }
    });
    await prisma.districtReseller.upsert({
      where: { id },
      update: { email: d.email, district: d.name, lat: d.lat, lng: d.lng },
      create: { id, email: d.email, district: d.name, lat: d.lat, lng: d.lng }
    });
    console.log(`   ✅ ${d.name} (${id})`);
  }

  // 2. Create Upazilla Resellers
  console.log("\n🏘️ Provisioning Upazilla Resellers...");
  for (const u of UPAZILLAS) {
    const id = await signUpAndGetId(u.email);
    if (!id) continue;
    await prisma.profile.upsert({
      where: { id },
      update: {
        type: "upazilla_reseller",
        fullName: u.name + " Upazilla Hub", city: u.district, upazilla: u.name,
        username: u.name.toLowerCase().replace(/\s/g, ''),
        storeName: u.name + " Hub",
        lat: u.lat, lng: u.lng
      },
      create: {
        id, type: "upazilla_reseller",
        fullName: u.name + " Upazilla Hub", city: u.district, upazilla: u.name,
        username: u.name.toLowerCase().replace(/\s/g, ''),
        storeName: u.name + " Hub",
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: u.lat, lng: u.lng
      }
    });
    await prisma.upazillaReseller.upsert({
      where: { id },
      update: { email: u.email, city: u.district, upazilla: u.name, lat: u.lat, lng: u.lng },
      create: { id, email: u.email, city: u.district, upazilla: u.name, lat: u.lat, lng: u.lng }
    });
    console.log(`   ✅ ${u.name} (${id})`);
  }

  // 3. Create Local Resellers
  console.log("\n🏪 Provisioning Local Resellers...");
  for (const l of LOCAL_RESELLERS) {
    const id = await signUpAndGetId(l.email);
    if (!id) continue;
    await prisma.profile.upsert({
      where: { id },
      update: {
        type: "local_reseller",
        fullName: l.name, city: l.name.split(' ')[0], upazilla: l.upazilla,
        username: l.name.toLowerCase().replace(/\s/g, ''),
        storeName: l.name,
        lat: l.lat, lng: l.lng
      },
      create: {
        id, type: "local_reseller",
        fullName: l.name, city: l.name.split(' ')[0], upazilla: l.upazilla,
        username: l.name.toLowerCase().replace(/\s/g, ''),
        storeName: l.name,
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: l.lat, lng: l.lng
      }
    });
    await prisma.localReseller.upsert({
      where: { id },
      update: { 
        email: l.email, city: l.name.split(' ')[0], upazilla: l.upazilla, lat: l.lat, lng: l.lng,
        username: l.name.toLowerCase().replace(/\s/g, ''),
        resellerCode: crypto.randomBytes(3).toString("hex").toUpperCase()
      },
      create: { 
        id, email: l.email, city: l.name.split(' ')[0], upazilla: l.upazilla, lat: l.lat, lng: l.lng,
        username: l.name.toLowerCase().replace(/\s/g, ''),
        resellerCode: crypto.randomBytes(3).toString("hex").toUpperCase()
      }
    });
    console.log(`   ✅ ${l.name} (${id})`);
  }

  // 4. Create Sellers
  console.log("\n🏭 Provisioning Sellers...");
  for (const s of SELLERS) {
    const id = await signUpAndGetId(s.email);
    if (!id) continue;
    await prisma.profile.upsert({
      where: { id },
      update: {
        type: "seller",
        fullName: s.name, storeName: s.name, city: s.city, upazilla: s.upazilla,
        username: s.name.toLowerCase().replace(/\s/g, ''),
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: s.lat, lng: s.lng
      },
      create: {
        id, type: "seller",
        fullName: s.name, storeName: s.name, city: s.city, upazilla: s.upazilla,
        username: s.name.toLowerCase().replace(/\s/g, ''),
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: s.lat, lng: s.lng
      }
    });
    console.log(`   ✅ ${s.name} (${id})`);
  }

  // 5. Create Buyers
  console.log("\n🛒 Provisioning Buyers...");
  for (const b of BUYERS) {
    const id = await signUpAndGetId(b.email);
    if (!id) continue;
    await prisma.profile.upsert({
      where: { id },
      update: {
        type: "buyer",
        fullName: b.name, city: "Dhaka", upazilla: "City Center",
        username: b.name.toLowerCase().replace(/\s/g, ''),
        storeName: "Buyer",
        lat: 23.8103, lng: 90.4125
      },
      create: {
        id, type: "buyer",
        fullName: b.name, city: "Dhaka", upazilla: "City Center",
        username: b.name.toLowerCase().replace(/\s/g, ''),
        storeName: "Buyer",
        sellerCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
        lat: 23.8103, lng: 90.4125
      }
    });
    await prisma.buyerProfile.upsert({
      where: { id },
      update: { email: b.email, fullName: b.name },
      create: { id, email: b.email, fullName: b.name }
    });
    console.log(`   ✅ ${b.name} (${id})`);
  }

  // 6. Seed Global Products
  console.log("\n📦 Seeding Products...");
  const rice = await prisma.globalProduct.create({
    data: { name: "Premium Miniket Rice (50kg)", category: "Groceries" }
  });
  const keyboard = await prisma.globalProduct.create({
    data: { name: "Mechanical Gaming Keyboard", category: "Electronics" }
  });
  const oil = await prisma.globalProduct.create({
    data: { name: "Soybean Oil (5L)", category: "Groceries" }
  });
  console.log(`   ✅ Rice, Keyboard, Soybean Oil created.`);

  // 7. Distribute Stock to Sellers
  const sellers = await prisma.profile.findMany({ where: { type: "seller" } });
  
  for (const seller of sellers) {
    await prisma.sellerProduct.create({
      data: {
        sellerId: seller.id,
        globalProductId: rice.id,
        customName: rice.name,
        productCode: `RICE-${seller.sellerCode}`,
        price: 3200,
        stock: 5000,
        status: "approved"
      }
    });
    await prisma.sellerProduct.create({
      data: {
        sellerId: seller.id,
        globalProductId: keyboard.id,
        customName: keyboard.name,
        productCode: `KEYB-${seller.sellerCode}`,
        price: 2800,
        stock: 500,
        status: "approved"
      }
    });
    await prisma.sellerProduct.create({
      data: {
        sellerId: seller.id,
        globalProductId: oil.id,
        customName: oil.name,
        productCode: `OIL-${seller.sellerCode}`,
        price: 850,
        stock: 2000,
        status: "approved"
      }
    });
  }
  console.log(`   ✅ 3 Products allocated to ${sellers.length} Sellers with high stock.`);

  // 8. Distribute initial small stock to hubs so dashboards aren't empty
  const districts = await prisma.profile.findMany({ where: { type: "district_reseller" } });
  const upazillas = await prisma.profile.findMany({ where: { type: "upazilla_reseller" } });

  for (const d of districts) {
    await prisma.districtStockItem.create({ data: { districtResellerId: d.id, productName: rice.name, quantity: 200 } });
    await prisma.districtStockItem.create({ data: { districtResellerId: d.id, productName: oil.name, quantity: 50 } });
  }

  for (const u of upazillas) {
    await prisma.upazillaStockItem.create({ data: { upazillaResellerId: u.id, productName: rice.name, quantity: 50 } });
    await prisma.upazillaStockItem.create({ data: { upazillaResellerId: u.id, productName: keyboard.name, quantity: 5 } });
  }
  console.log(`   ✅ Initial hub stock seeded.`);

  // 9. Seed Demands to trigger ACO
  console.log("\n📈 Seeding Demands for ACO Pipeline...");
  const localResellers = await prisma.profile.findMany({ where: { type: "local_reseller" } });
  
  for (const local of localResellers) {
    // Generate demands
    await prisma.localDemand.create({
      data: { localResellerId: local.id, productName: rice.name, productCode: "RICE-GENERIC", demandQuantity: 300, status: "pending" }
    });
    await prisma.localDemand.create({
      data: { localResellerId: local.id, productName: keyboard.name, productCode: "KEYB-GENERIC", demandQuantity: 20, status: "pending" }
    });
    await prisma.localDemand.create({
      data: { localResellerId: local.id, productName: oil.name, productCode: "OIL-GENERIC", demandQuantity: 100, status: "pending" }
    });
  }
  console.log(`   ✅ Cascading Demands seeded across ${localResellers.length} local resellers.`);

  console.log("\n🎉 Versatile Production Seed Completed Successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
