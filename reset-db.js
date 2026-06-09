const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

async function resetDB() {
  console.log("Starting full database reset for users, auth, and supply chain...");

  try {
    // 1. Delete all relational data first (Supply Chain & Demands & Orders)
    console.log("Deleting demands and negotiations...");
    await prisma.stockOrderNegotiation.deleteMany();
    await prisma.upazillaDemand.deleteMany();
    await prisma.districtDemand.deleteMany();
    
    console.log("Deleting transfers...");
    await prisma.nationalTransfer.deleteMany();
    await prisma.districtTransfer.deleteMany();
    await prisma.stockTransfer.deleteMany();

    console.log("Deleting stocks...");
    await prisma.resellerStockItem.deleteMany();
    await prisma.upazillaStockItem.deleteMany();
    await prisma.upazillaAvailableStock.deleteMany();
    await prisma.districtStockItem.deleteMany();
    
    console.log("Deleting orders and cart...");
    await prisma.orderNotification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.buyerBehaviour.deleteMany();
    await prisma.sellerProduct.deleteMany();

    // 2. Delete all profiles (Users)
    console.log("Deleting reseller profiles...");
    await prisma.localReseller.deleteMany();
    await prisma.upazillaReseller.deleteMany();
    await prisma.districtReseller.deleteMany();
    await prisma.cityReseller.deleteMany();
    
    console.log("Deleting buyer and seller profiles...");
    await prisma.buyerProfile.deleteMany();
    await prisma.profile.deleteMany();

    // 3. Delete Supabase Auth Users directly via raw SQL
    // This allows the user to re-register with the exact same emails.
    console.log("Deleting Supabase Auth Users...");
    await prisma.$executeRaw`DELETE FROM auth.users;`;

    console.log("✅ Database reset complete. You can now sign up from scratch!");
  } catch (error) {
    console.error("❌ Error during database reset:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDB();
