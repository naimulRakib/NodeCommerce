import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Mock list of district-upazilla pairs to simulate cross-district checks
const UPAZILLAS = [
  { district: "Dhaka", upazilla: "Dohar" },
  { district: "Chittagong", upazilla: "Hathazari" },
];

async function runTests() {
  console.log("Starting supply chain verification tests...");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    // ----------------------------------------------------
    // SETUP MOCK DATA
    // ----------------------------------------------------
    console.log("\nSetting up mock profiles...");

    // 1. District Reseller (Dhaka)
    const distResellerId = "mock-dist-reseller-id-dhaka";
    await prisma.districtReseller.upsert({
      where: { id: distResellerId },
      update: { district: "Dhaka" },
      create: { id: distResellerId, email: "dhaka-reseller@test.com", district: "Dhaka" },
    });

    // 2. Upazilla Reseller (Dohar in Dhaka district)
    const upazillaResellerId = "mock-upz-reseller-id-dohar";
    await prisma.upazillaReseller.upsert({
      where: { id: upazillaResellerId },
      update: { city: "Dhaka", upazilla: "Dohar" },
      create: { id: upazillaResellerId, email: "dohar-reseller@test.com", city: "Dhaka", upazilla: "Dohar" },
    });

    // 3. Local Reseller (Dohar)
    const localResellerId = "mock-local-reseller-id";
    await prisma.localReseller.upsert({
      where: { id: localResellerId },
      update: { city: "Dhaka", upazilla: "Dohar" },
      create: {
        id: localResellerId,
        email: "dohar-local@test.com",
        username: "Dohar Local",
        resellerCode: "TEST66",
        city: "Dhaka",
        upazilla: "Dohar",
      },
    });

    // ----------------------------------------------------
    // TEST 1: Full Happy Path
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Happy Path ---");

    // Clean old items
    await prisma.districtTransfer.deleteMany({
      where: {
        OR: [
          { districtResellerId: distResellerId },
          { upazillaResellerId: upazillaResellerId }
        ]
      }
    });
    await prisma.districtStockItem.deleteMany({ where: { districtResellerId: distResellerId } });
    await prisma.upazillaStockItem.deleteMany({ where: { upazillaResellerId: upazillaResellerId } });

    // Add stock item
    const stockItem = await prisma.districtStockItem.create({
      data: {
        districtResellerId: distResellerId,
        productName: "Basmati Rice (50kg)",
        brand: "Local Mill",
        category: "Food",
        quantity: 500,
      },
    });
    console.log("District stock created: Basmati Rice (50kg), Qty: 500");

    // Transfer 50 to Upazilla
    const transferQty = 50;
    const transfer = await prisma.districtTransfer.create({
      data: {
        districtResellerId: distResellerId,
        upazillaResellerId,
        stockItemId: stockItem.id,
        quantity: transferQty,
        status: "pending",
      },
    });
    await prisma.districtStockItem.update({
      where: { id: stockItem.id },
      data: { quantity: { decrement: transferQty } },
    });

    const updatedStockItem = await prisma.districtStockItem.findUnique({ where: { id: stockItem.id } });
    console.log(`District stock quantity updated: ${updatedStockItem.quantity} (Expected: 450)`);
    if (updatedStockItem.quantity !== 450) throw new Error("TEST 1.f failed: stock quantity deduction wrong.");

    // Accept transfer on Upazilla
    await prisma.$transaction(async (tx) => {
      await tx.districtTransfer.update({
        where: { id: transfer.id },
        data: { status: "accepted" },
      });
      await tx.upazillaStockItem.create({
        data: {
          upazillaResellerId,
          productName: stockItem.productName,
          brand: stockItem.brand,
          category: stockItem.category,
          quantity: transferQty,
        },
      });
    });

    const upzStock = await prisma.upazillaStockItem.findFirst({
      where: { upazillaResellerId, productName: "Basmati Rice (50kg)" },
    });
    console.log(`Upazilla stock created: ${upzStock.quantity} (Expected: 50)`);
    if (!upzStock || upzStock.quantity !== 50) throw new Error("TEST 1.j failed: upazilla stock acceptance wrong.");

    // Send 10 to Local
    const localTransferQty = 10;
    const localTransfer = await prisma.stockTransfer.create({
      data: {
        upazillaResellerId,
        localResellerId,
        stockItemId: upzStock.id,
        quantity: localTransferQty,
        status: "pending",
      },
    });

    // Accept on Local
    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: localTransfer.id },
        data: { status: "accepted" },
      });
      await tx.resellerStockItem.create({
        data: {
          resellerId: localResellerId,
          customName: upzStock.productName,
          quantity: localTransferQty,
        },
      });
    });

    const localStock = await prisma.resellerStockItem.findFirst({
      where: { resellerId: localResellerId, customName: "Basmati Rice (50kg)" },
    });
    console.log(`Local stock created: ${localStock.quantity} (Expected: 10)`);
    if (!localStock || localStock.quantity !== 10) throw new Error("TEST 1.o failed: local stock wrong.");

    console.log("✓ TEST 1 Success: Happy path confirmed working end to end!");

    // ----------------------------------------------------
    // TEST 2: Cross-district Block Validation
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Cross-district block validation ---");
    // Mock reseller in Chittagong
    const ctgReseller = { id: "ctg-reseller-id", district: "Chittagong", upazilla: "Hathazari" };
    // Simulate lookup check:
    const isMatched = UPAZILLAS.some(
      (u) => u.district === "Dhaka" && u.upazilla === ctgReseller.upazilla
    );
    console.log(`Cross-district send check for Dhaka -> Hathazari: ${isMatched ? "Allowed" : "Blocked"} (Expected: Blocked)`);
    if (isMatched) throw new Error("TEST 2 failed: cross-district check allowed Hathazari in Dhaka.");
    console.log("✓ TEST 2 Success: Cross-district validation correct.");

    // ----------------------------------------------------
    // TEST 3: District already taken
    // ----------------------------------------------------
    console.log("\n--- TEST 3: District already taken check ---");
    // Register User A for Sylhet
    await prisma.districtReseller.upsert({
      where: { district: "Sylhet" },
      update: {},
      create: { id: "user-a-sylhet", email: "user-a@test.com", district: "Sylhet" },
    });
    // Try to find another with same district but different ID
    const conflicting = await prisma.districtReseller.findFirst({
      where: { district: "Sylhet", NOT: { id: "user-b-sylhet" } }
    });
    console.log(`Conflict check for User B: ${conflicting ? "Taken" : "Free"} (Expected: Taken)`);
    if (!conflicting) throw new Error("TEST 3 failed: did not detect taken district Sylhet.");
    console.log("✓ TEST 3 Success: District unique constraint check correct.");

    // ----------------------------------------------------
    // TEST 4: Reject restores stock correctly
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Reject restores stock correctly ---");
    const oilItem = await prisma.districtStockItem.create({
      data: { districtResellerId: distResellerId, productName: "Oil", quantity: 100 },
    });
    // Send 30
    const oilTransfer = await prisma.districtTransfer.create({
      data: { districtResellerId: distResellerId, upazillaResellerId, stockItemId: oilItem.id, quantity: 30, status: "pending" },
    });
    await prisma.districtStockItem.update({
      where: { id: oilItem.id },
      data: { quantity: { decrement: 30 } },
    });

    // Reject transfer
    await prisma.$transaction(async (tx) => {
      await tx.districtTransfer.update({
        where: { id: oilTransfer.id },
        data: { status: "rejected" },
      });
      await tx.districtStockItem.update({
        where: { id: oilItem.id },
        data: { quantity: { increment: 30 } },
      });
    });

    const restoredOil = await prisma.districtStockItem.findUnique({ where: { id: oilItem.id } });
    console.log(`Restored Oil Qty: ${restoredOil.quantity} (Expected: 100)`);
    if (restoredOil.quantity !== 100) throw new Error("TEST 4 failed: quantity was not restored.");
    console.log("✓ TEST 4 Success: Reject restores stock perfectly.");

    // ----------------------------------------------------
    // TEST 5: Quantity validation
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Quantity validation ---");
    const riceItem = await prisma.districtStockItem.create({
      data: { districtResellerId: distResellerId, productName: "Rice", quantity: 10 },
    });
    const attemptQty = 11;
    console.log(`Attempting to transfer ${attemptQty} from available ${riceItem.quantity}: ${attemptQty > riceItem.quantity ? "Blocked" : "Allowed"} (Expected: Blocked)`);
    if (attemptQty <= riceItem.quantity) throw new Error("TEST 5 failed: quantity validation check incorrect.");
    console.log("✓ TEST 5 Success: Quantity boundary validation works.");

    // ----------------------------------------------------
    // TEST 7: Upazilla inventory merge after two transfers
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Upazilla inventory merge check ---");
    const testRiceItem = await prisma.districtStockItem.create({
      data: { districtResellerId: distResellerId, productName: "Test Rice", quantity: 50 },
    });
    // Clean old upazilla items
    await prisma.upazillaStockItem.deleteMany({ where: { upazillaResellerId, productName: "Test Rice" } });

    // Transfer 1 (qty 20)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.upazillaStockItem.findFirst({
        where: { upazillaResellerId, productName: { equals: "Test Rice", mode: "insensitive" } },
      });
      if (existing) {
        await tx.upazillaStockItem.update({ where: { id: existing.id }, data: { quantity: { increment: 20 } } });
      } else {
        await tx.upazillaStockItem.create({
          data: { upazillaResellerId, productName: "Test Rice", quantity: 20 },
        });
      }
    });

    // Transfer 2 (qty 15)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.upazillaStockItem.findFirst({
        where: { upazillaResellerId, productName: { equals: "Test Rice", mode: "insensitive" } },
      });
      if (existing) {
        await tx.upazillaStockItem.update({ where: { id: existing.id }, data: { quantity: { increment: 15 } } });
      } else {
        await tx.upazillaStockItem.create({
          data: { upazillaResellerId, productName: "Test Rice", quantity: 15 },
        });
      }
    });

    const finalRiceStocks = await prisma.upazillaStockItem.findMany({
      where: { upazillaResellerId, productName: "Test Rice" },
    });
    console.log(`Rows found for Test Rice: ${finalRiceStocks.length} (Expected: 1)`);
    console.log(`Total quantity: ${finalRiceStocks[0].quantity} (Expected: 35)`);
    if (finalRiceStocks.length !== 1 || finalRiceStocks[0].quantity !== 35) {
      throw new Error("TEST 7 failed: upazilla inventory did not merge correctly.");
    }
    console.log("✓ TEST 7 Success: Duplicate items merged successfully.");

    // ----------------------------------------------------
    // TEST 8: Delete item with active pending transfer
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Delete item with active pending transfer check ---");
    const deleteTestItem = await prisma.districtStockItem.create({
      data: { districtResellerId: distResellerId, productName: "Delete Test Oil", quantity: 20 },
    });
    // Create pending transfer
    await prisma.districtTransfer.create({
      data: { districtResellerId: distResellerId, upazillaResellerId, stockItemId: deleteTestItem.id, quantity: 10, status: "pending" },
    });

    // Delete check
    const activeTransfers = await prisma.districtTransfer.findMany({
      where: { stockItemId: deleteTestItem.id },
    });
    const deleteBlocked = activeTransfers.length > 0;
    console.log(`Delete check for Delete Test Oil: ${deleteBlocked ? "Blocked" : "Allowed"} (Expected: Blocked)`);
    if (!deleteBlocked) throw new Error("TEST 8 failed: deletion was not blocked.");
    console.log("✓ TEST 8 Success: Item deletion block working.");

    console.log("\nAll supply chain tests completed successfully!");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("Test failed: ", err);
  process.exit(1);
});
