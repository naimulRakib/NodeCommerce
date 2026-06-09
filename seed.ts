import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./src/lib/prisma";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const defaultPassword = "password123";

const accounts = [
  { 
    email: "admin@acmefoods.com", 
    pass: defaultPassword, 
    type: "seller",
    storeName: "Acme Foods Wholesale",
    fullName: "Acme Admin",
    city: "Comilla",
    upazilla: "Burichang",
    code: "SEL-ACME-1"
  },
  { 
    email: "hub@comilla.nodecom.bd", 
    pass: defaultPassword, 
    type: "district", 
    district: "Comilla" 
  },
  { 
    email: "distributor@burichang.nodecom.bd", 
    pass: defaultPassword, 
    type: "upazilla", 
    city: "Comilla", 
    upazilla: "Burichang" 
  },
  { 
    email: "distributor@brahmanpara.nodecom.bd", 
    pass: defaultPassword, 
    type: "upazilla", 
    city: "Comilla", 
    upazilla: "Brahmanpara" 
  },
  { 
    email: "bhaibhai@burichang.nodecom.bd", 
    pass: defaultPassword, 
    type: "local", 
    city: "Comilla", 
    upazilla: "Burichang", 
    code: "LOC-BUR-1", 
    storeName: "Bhai Bhai Store",
    lat: 23.55,
    lng: 91.13
  },
  { 
    email: "mayerdoa@burichang.nodecom.bd", 
    pass: defaultPassword, 
    type: "local", 
    city: "Comilla", 
    upazilla: "Burichang", 
    code: "LOC-BUR-2", 
    storeName: "Mayer Doa Traders",
    lat: 23.56,
    lng: 91.14
  },
  { 
    email: "janata@brahmanpara.nodecom.bd", 
    pass: defaultPassword, 
    type: "local", 
    city: "Comilla", 
    upazilla: "Brahmanpara", 
    code: "LOC-BRA-1", 
    storeName: "Janata Departmental",
    lat: 23.61,
    lng: 91.10
  },
  { 
    email: "milon@brahmanpara.nodecom.bd", 
    pass: defaultPassword, 
    type: "local", 
    city: "Comilla", 
    upazilla: "Brahmanpara", 
    code: "LOC-BRA-2", 
    storeName: "Milon Enterprise",
    lat: 23.62,
    lng: 91.11
  }
];

const realisticProducts = [
  { name: "Premium Miniket Rice 50kg", brand: "Acme Foods", category: "Groceries", price: 3500, stock: 1000, code: "PRD-RICE-01" },
  { name: "Soybean Oil 5L", brand: "Acme Foods", category: "Groceries", price: 820, stock: 2500, code: "PRD-OIL-01" },
  { name: "Red Lentils 1kg", brand: "Acme Foods", category: "Groceries", price: 110, stock: 5000, code: "PRD-LENTIL-01" },
  { name: "Farm Fresh Eggs (1 Dozen)", brand: "Acme Farms", category: "Groceries", price: 150, stock: 800, code: "PRD-EGG-01" },
  { name: "Full Cream Milk Powder 1kg", brand: "Acme Dairy", category: "Groceries", price: 850, stock: 1200, code: "PRD-MILK-01" },
  { name: "Premium Tea Leaves 500g", brand: "Acme Tea", category: "Groceries", price: 220, stock: 3000, code: "PRD-TEA-01" }
];

async function seed() {
  console.log("Cleaning up first...");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE auth.users CASCADE;`);
  
  // Wipe product and profile tables explicitly since they aren't FKed to auth.users in Prisma
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE global_products CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE profiles CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DistrictReseller" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "UpazillaReseller" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "LocalReseller" CASCADE;`);
  
  console.log("Starting seed process...");
  
  let sellerId: string | null = null;

  for (const acc of accounts) {
    console.log(`Signing up ${acc.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: acc.email,
      password: acc.pass,
    });

    if (error) {
      console.error(`Error signing up ${acc.email}:`, error.message);
      continue;
    }

    const userId = data.user?.id;
    if (!userId) {
      console.error(`No user ID returned for ${acc.email}`);
      continue;
    }

    console.log(`Success. User ID: ${userId}. Inserting into Prisma...`);

    try {
      if (acc.type === "seller") {
        sellerId = userId;
        await prisma.profile.create({
          data: {
            id: userId,
            username: "admin_acmefoods",
            type: "seller",
            storeName: acc.storeName!,
            fullName: acc.fullName!,
            phone: "01700000000",
            lat: 23.4607,
            lng: 91.1809,
            city: acc.city!,
            upazilla: acc.upazilla!,
            sellerCode: acc.code!
          }
        });
      } else if (acc.type === "district") {
        await prisma.districtReseller.create({
          data: {
            id: userId,
            email: acc.email,
            district: acc.district!,
          }
        });
      } else if (acc.type === "upazilla") {
        await prisma.upazillaReseller.create({
          data: {
            id: userId,
            email: acc.email,
            city: acc.city!,
            upazilla: acc.upazilla!,
          }
        });
      } else if (acc.type === "local") {
        await prisma.localReseller.create({
          data: {
            id: userId,
            email: acc.email,
            username: acc.storeName!,
            fullName: "Local Proprietor",
            phone: "01800000000",
            city: acc.city!,
            upazilla: acc.upazilla!,
            resellerCode: acc.code!,
            lat: acc.lat,
            lng: acc.lng
          }
        });
      }
      console.log(`✅ Inserted ${acc.type} profile for ${acc.email}`);
    } catch (dbError) {
      console.error(`❌ DB Error for ${acc.email}:`, dbError);
    }
  }

  // Seed Products
  if (sellerId) {
    console.log("\\nSeeding realistic products...");
    for (const prod of realisticProducts) {
      // 1. Create Global Product
      const globalProd = await prisma.globalProduct.create({
        data: {
          name: prod.name,
          brand: prod.brand,
          category: prod.category,
        }
      });

      // 2. Map to Seller
      await prisma.sellerProduct.create({
        data: {
          sellerId: sellerId,
          globalProductId: globalProd.id,
          customName: prod.name,
          stock: prod.stock,
          price: prod.price,
          status: "approved",
          productCode: prod.code
        }
      });
      console.log(`📦 Added ${prod.name} with ${prod.stock} stock.`);
    }
  }

  console.log("\\n=======================================================");
  console.log("🏆 Seed Complete! You can login with the following credentials:");
  console.log("=======================================================");
  console.table(accounts.map(a => ({ Role: a.type, Email: a.email, Password: a.pass, Store: a.storeName || a.district || a.upazilla })));
  console.log("=======================================================\\n");

  await prisma.$disconnect();
}

seed();
