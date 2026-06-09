import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./src/lib/prisma";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const defaultPassword = "password123";

const dhakaAccounts = [
  {
    email: "admin@dhakafoods.com",
    pass: defaultPassword,
    type: "seller",
    storeName: "Dhaka Foods Ltd",
    fullName: "Dhaka Admin",
    city: "Dhaka",
    upazilla: "Mirpur",
    code: "SEL-DHAKA-1",
    lat: 23.8223,
    lng: 90.3654
  },
  {
    email: "hub@dhaka.nodecom.bd",
    pass: defaultPassword,
    type: "district",
    district: "Dhaka"
  },
  {
    email: "distributor@mirpur.nodecom.bd",
    pass: defaultPassword,
    type: "upazilla",
    city: "Dhaka",
    upazilla: "Mirpur"
  },
  {
    email: "distributor@dhanmondi.nodecom.bd",
    pass: defaultPassword,
    type: "upazilla",
    city: "Dhaka",
    upazilla: "Dhanmondi"
  },
  {
    email: "sunshine@mirpur.nodecom.bd",
    pass: defaultPassword,
    type: "local",
    city: "Dhaka",
    upazilla: "Mirpur",
    code: "LOC-MIR-1",
    storeName: "Sunshine Grocery",
    lat: 23.8200,
    lng: 90.3620
  },
  {
    email: "popular@mirpur.nodecom.bd",
    pass: defaultPassword,
    type: "local",
    city: "Dhaka",
    upazilla: "Mirpur",
    code: "LOC-MIR-2",
    storeName: "Popular Mart",
    lat: 23.8250,
    lng: 90.3680
  },
  {
    email: "fresh@dhanmondi.nodecom.bd",
    pass: defaultPassword,
    type: "local",
    city: "Dhaka",
    upazilla: "Dhanmondi",
    code: "LOC-DHA-1",
    storeName: "Fresh Corner",
    lat: 23.7461,
    lng: 90.3742
  },
  {
    email: "excel@dhanmondi.nodecom.bd",
    pass: defaultPassword,
    type: "local",
    city: "Dhaka",
    upazilla: "Dhanmondi",
    code: "LOC-DHA-2",
    storeName: "Excel Store",
    lat: 23.7500,
    lng: 90.3780
  }
];

// Products for the Dhaka seller – we add them to the SAME global products
// so inter-district routing uses the same product names.
const dhakaSellerProducts = [
  { globalName: "Premium Miniket Rice 50kg", stock: 800, price: 3500, code: "PRD-RICE-02" },
  { globalName: "Soybean Oil 5L",             stock: 300, price: 820,  code: "PRD-OIL-02"  },
  { globalName: "Red Lentils 1kg",            stock: 200, price: 110,  code: "PRD-LENTIL-02" }
];

async function seedDhaka() {
  console.log("Starting Dhaka seed process (additive — will not wipe existing data)...");

  let dhakaDistrictId: string | null = null;
  let dhakaSellerId: string | null = null;
  const createdIds: Record<string, string> = {};

  for (const acc of dhakaAccounts) {
    console.log(`Signing up ${acc.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: acc.email,
      password: acc.pass,
    });

    if (error) {
      console.error(`❌ Error signing up ${acc.email}:`, error.message);
      continue;
    }

    const userId = data.user?.id;
    if (!userId) {
      console.error(`No user ID for ${acc.email}`);
      continue;
    }

    createdIds[acc.email] = userId;
    console.log(`  → User ID: ${userId}`);

    try {
      if (acc.type === "seller") {
        dhakaSellerId = userId;
        await prisma.profile.create({
          data: {
            id: userId,
            username: "admin_dhakafoods",
            type: "seller",
            storeName: acc.storeName!,
            fullName: acc.fullName!,
            phone: "01711000000",
            lat: acc.lat!,
            lng: acc.lng!,
            city: acc.city!,
            upazilla: acc.upazilla!,
            sellerCode: acc.code!
          }
        });
      } else if (acc.type === "district") {
        dhakaDistrictId = userId;
        await prisma.districtReseller.create({
          data: { id: userId, email: acc.email, district: acc.district! }
        });
      } else if (acc.type === "upazilla") {
        await prisma.upazillaReseller.create({
          data: { id: userId, email: acc.email, city: acc.city!, upazilla: acc.upazilla! }
        });
      } else if (acc.type === "local") {
        await prisma.localReseller.create({
          data: {
            id: userId,
            email: acc.email,
            username: acc.storeName!,
            fullName: "Local Proprietor",
            phone: "01900000000",
            city: acc.city!,
            upazilla: acc.upazilla!,
            resellerCode: acc.code!,
            lat: acc.lat,
            lng: acc.lng
          }
        });
      }
      console.log(`  ✅ Inserted ${acc.type} for ${acc.email}`);
    } catch (err) {
      console.error(`  ❌ DB error for ${acc.email}:`, err);
    }
  }

  // Add products for Dhaka seller using existing GlobalProducts
  if (dhakaSellerId) {
    console.log("\nSeeding Dhaka seller products (linked to existing GlobalProducts)...");
    for (const dp of dhakaSellerProducts) {
      const gp = await prisma.globalProduct.findFirst({
        where: { name: { equals: dp.globalName, mode: "insensitive" } }
      });
      if (!gp) {
        console.warn(`  ⚠️  GlobalProduct not found: ${dp.globalName}. Run seed.ts first.`);
        continue;
      }
      await prisma.sellerProduct.create({
        data: {
          sellerId: dhakaSellerId,
          globalProductId: gp.id,
          customName: dp.globalName,
          stock: dp.stock,
          price: dp.price,
          status: "approved",
          productCode: dp.code
        }
      });
      console.log(`  📦 Added ${dp.globalName} (${dp.stock} units) for Dhaka seller`);
    }
  }

  console.log("\n=======================================================");
  console.log("🏙️  Dhaka Network Ready! New login credentials:");
  console.log("=======================================================");
  console.table(dhakaAccounts.map(a => ({
    Role: a.type,
    Email: a.email,
    Password: a.pass,
    Store: a.storeName || a.district || a.upazilla
  })));
  console.log("=======================================================\n");

  await prisma.$disconnect();
}

seedDhaka();
