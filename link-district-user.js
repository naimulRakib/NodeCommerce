const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

async function linkAuth() {
  const email = "cumilla@gmail.com";
  
  // 1. Find the newly registered user by email in the profiles/resellers (Wait, Supabase Auth holds the email)
  // Let's just find the newly created district reseller if they tried to register, 
  // but they'd fail step 2 because the district is taken.
  // Actually, we can fetch from Supabase if we have access, but we don't from Prisma.
  // We can ask the user to just provide the ID, or we can look for any DistrictReseller that has email but no district? No, DistrictReseller requires district.
  
  console.log("Please run this script passing your new Auth UUID as an argument.");
  console.log("Example: node link-district-user.js 8d2f-1234-5678...");
  
  const newId = process.argv[2];
  if (!newId) return;

  try {
    // We need to update the ID. But ID is the primary key. In Prisma, updating a primary key is supported, but it cascades.
    await prisma.districtReseller.update({
      where: { id: "demo-district-cumilla" },
      data: { id: newId }
    });
    console.log("Successfully linked seeded data to your new auth account!");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

linkAuth();
