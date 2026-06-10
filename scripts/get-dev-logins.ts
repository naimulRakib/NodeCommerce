import { PrismaClient } from "../src/generated/prisma";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== DEV LOGIN BYPASS LINKS GENERATOR ===");
  
  // 1. Sellers
  const sellers = await prisma.profile.findMany({
    where: { type: "seller" },
    select: { id: true, username: true, storeName: true, city: true, upazilla: true }
  });
  console.log("\n📦 SELLERS:");
  sellers.forEach(s => {
    console.log(`- ${s.storeName} (${s.upazilla}, ${s.city})`);
    console.log(`  Bypass URL: http://localhost:3000/api/dev-login?id=${s.id}&redirectTo=/seller/dashboard`);
  });

  // 2. District Resellers
  const districts = await prisma.districtReseller.findMany({
    select: { id: true, email: true, district: true }
  });
  console.log("\n🏢 DISTRICT RESELLERS:");
  districts.forEach(d => {
    console.log(`- ${d.district} District Hub (${d.email})`);
    console.log(`  Bypass URL: http://localhost:3000/api/dev-login?id=${d.id}&redirectTo=/district-reseller/dashboard`);
  });

  // 3. Upazilla Resellers
  const upazillas = await prisma.upazillaReseller.findMany({
    select: { id: true, email: true, city: true, upazilla: true }
  });
  console.log("\n🌾 UPAZILLA RESELLERS:");
  upazillas.forEach(u => {
    console.log(`- ${u.upazilla} (${u.city}) (${u.email})`);
    console.log(`  Bypass URL: http://localhost:3000/api/dev-login?id=${u.id}&redirectTo=/upazilla-reseller/dashboard`);
  });

  // 4. Local Resellers
  const locals = await prisma.localReseller.findMany({
    select: { id: true, username: true, email: true, city: true, upazilla: true }
  });
  console.log("\n🏪 LOCAL RESELLERS:");
  locals.forEach(l => {
    console.log(`- ${l.username} (${l.upazilla}, ${l.city}) (${l.email})`);
    console.log(`  Bypass URL: http://localhost:3000/api/dev-login?id=${l.id}&redirectTo=/local-reseller/dashboard`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
