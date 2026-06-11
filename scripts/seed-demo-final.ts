import { prisma } from "../src/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeDatabase() {
  console.log("Wiping all public tables...");
  const tablenames = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';`
  );
  const tables = tablenames.map(({ tablename }) => `"${tablename}"`).join(', ');
  if (tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }
  console.log("Public tables wiped.");

  console.log("Wiping auth.users...");
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM auth.users CASCADE;`);
    console.log("auth.users wiped.");
  } catch (e: any) {
    console.warn("Could not wipe auth.users. They might still exist.", e.message);
  }
}

async function createAuthUser(email: string, pass: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });
  if (error || !data.user) {
    console.log(`Failed or already exists: ${email}`, error?.message);
    // If it exists, try to log in to get the ID
    const login = await supabase.auth.signInWithPassword({ email, password: pass });
    if (login.data.user) return login.data.user.id;
    throw new Error(`Cannot get user id for ${email}`);
  }
  return data.user.id;
}

async function main() {
  await wipeDatabase();

  const password = "Password123!";
  console.log(`\nCreating 5 Accounts with password: ${password}`);

  // 1. Create District Reseller
  const districtId = await createAuthUser("district@demo.com", password);
  await prisma.districtReseller.create({
    data: { id: districtId, email: "district@demo.com", district: "Dhaka" },
  });
  console.log("✅ District Reseller (district@demo.com)");

  // 2. Create Upazilla Reseller
  const upazillaId = await createAuthUser("upazilla@demo.com", password);
  await prisma.upazillaReseller.create({
    data: { id: upazillaId, email: "upazilla@demo.com", city: "Dhaka", upazilla: "Dhanmondi" },
  });
  console.log("✅ Upazilla Reseller (upazilla@demo.com)");

  // 3. Create Local Reseller
  const localId = await createAuthUser("local@demo.com", password);
  await prisma.localReseller.create({
    data: {
      id: localId, email: "local@demo.com", username: "Dhanmondi Local Hub",
      city: "Dhaka", upazilla: "Dhanmondi", resellerCode: "DHN-01",
      lat: 23.7465, lng: 90.3760,
    },
  });
  console.log("✅ Local Reseller (local@demo.com)");

  // 4. Create Seller
  const sellerId = await createAuthUser("seller@demo.com", password);
  await prisma.profile.create({
    data: {
      id: sellerId, type: "seller", username: "freshfarm", storeName: "Fresh Farm Goods",
      city: "Dhaka", upazilla: "Dhanmondi", sellerCode: "SEL-FFG",
      lat: 23.7460, lng: 90.3750,
    },
  });
  console.log("✅ Seller (seller@demo.com)");

  // 5. Create Buyer
  const buyerId = await createAuthUser("buyer@demo.com", password);
  await prisma.buyerProfile.create({
    data: {
      id: buyerId, email: "buyer@demo.com", fullName: "Naimul",
      phone: "01700000000", address: "Road 15, Dhanmondi",
      lat: 23.7460, lng: 90.3750,
    },
  });
  console.log("✅ Buyer (buyer@demo.com)");

  // Create 2 Global Products
  console.log("\nCreating Products...");
  const rice = await prisma.globalProduct.create({
    data: {
      name: "Premium Miniket Rice (50kg)",
      brand: "Fresh Farm",
      category: "Groceries",
      imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=60",
      description: "High quality premium miniket rice directly from farms.",
    },
  });

  const keyboard = await prisma.globalProduct.create({
    data: {
      name: "Mechanical Gaming Keyboard",
      brand: "TechPro",
      category: "Electronics",
      imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=60",
      description: "RGB Mechanical Gaming Keyboard with Blue Switches.",
    },
  });
  console.log("✅ Created 2 Global Products");

  // Give Seller 1000 units of Rice
  await prisma.sellerProduct.create({
    data: {
      sellerId: sellerId,
      globalProductId: rice.id,
      price: 3200, // 3200 BDT for 50kg
      stock: 1000,
      productCode: "RICE-100",
    },
  });
  console.log("✅ Seller initialized with 1,000 units of Rice.");

  // Also give seller 50 keyboards just for flavor
  await prisma.sellerProduct.create({
    data: {
      sellerId: sellerId,
      globalProductId: keyboard.id,
      price: 2500,
      stock: 50,
      productCode: "KEYB-200",
    },
  });

  console.log("\n🎉 Demo Environment Ready!");
  console.log("Accounts:");
  console.log("District: district@demo.com");
  console.log("Upazilla: upazilla@demo.com");
  console.log("Local:    local@demo.com");
  console.log("Seller:   seller@demo.com");
  console.log("Buyer:    buyer@demo.com");
  console.log("Password for ALL: Password123!");
}

main().catch(console.error).finally(() => process.exit(0));
