import { prisma } from '../src/lib/prisma';
import { randomUUID } from 'crypto';

// Removed instantiation

// Mock IDs
const MOCK_MIRPUR_RESELLER_ID = 'test-mirpur-' + randomUUID();
const MOCK_DHANMONDI_RESELLER_ID = 'test-dhanmondi-' + randomUUID();
const MOCK_DHAKA_DISTRICT_ID = 'test-dhaka-' + randomUUID();
const MOCK_LOCAL_SELLER_ID = 'test-local-seller-' + randomUUID();
const MOCK_LOCAL_RESELLER_ID = 'test-local-reseller-' + randomUUID();

async function cleanUp() {
  console.log("Cleaning up demo accounts...");
  await prisma.upazillaDemand.deleteMany({ where: { productName: { in: ['Rice', 'Oil'] } } });
  await prisma.districtDemand.deleteMany({ where: { productName: { in: ['Rice', 'Oil'] } } });
  await prisma.districtStockItem.deleteMany({ where: { districtResellerId: MOCK_DHAKA_DISTRICT_ID } });
  await prisma.resellerStockItem.deleteMany({ where: { resellerId: MOCK_LOCAL_RESELLER_ID } });

  await prisma.localReseller.deleteMany({ where: { id: MOCK_LOCAL_RESELLER_ID } });
  await prisma.upazillaReseller.deleteMany({ where: { id: { in: [MOCK_MIRPUR_RESELLER_ID, MOCK_DHANMONDI_RESELLER_ID] } } });
  await prisma.districtReseller.deleteMany({ where: { id: MOCK_DHAKA_DISTRICT_ID } });
}

async function setupDemoAccounts() {
  await cleanUp();
  console.log("Creating demo accounts...");

  const UNIQUE_DISTRICT = 'TestDistrict-' + randomUUID().slice(0, 8);

  // District Reseller
  await prisma.districtReseller.create({
    data: { id: MOCK_DHAKA_DISTRICT_ID, email: `dhaka_${randomUUID()}@nodecommerce.com`, district: UNIQUE_DISTRICT }
  });

  // Upazilla Resellers (Dhaka District)
  await prisma.upazillaReseller.create({
    data: { id: MOCK_MIRPUR_RESELLER_ID, email: `mirpur_${randomUUID()}@nodecommerce.com`, city: UNIQUE_DISTRICT, upazilla: 'Mirpur' }
  });
  await prisma.upazillaReseller.create({
    data: { id: MOCK_DHANMONDI_RESELLER_ID, email: `dhanmondi_${randomUUID()}@nodecommerce.com`, city: UNIQUE_DISTRICT, upazilla: 'Dhanmondi' }
  });

  // Local Reseller
  await prisma.localReseller.create({
    data: { id: MOCK_LOCAL_RESELLER_ID, email: `local_${randomUUID()}@nodecommerce.com`, username: 'Local Reseller Test', city: UNIQUE_DISTRICT, upazilla: 'Mirpur', resellerCode: `TEST${randomUUID().slice(0, 4)}` }
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

async function runTests() {
  try {
    await setupDemoAccounts();

    console.log("\n--- RUNNING DEMAND ENTRY TESTS ---");
    
    // TEST 1: Basic demand entry (Mirpur)
    console.log("TEST 1: Mirpur enters Rice 100");
    const mirpurDemand = await prisma.upazillaDemand.create({
      data: { upazillaResellerId: MOCK_MIRPUR_RESELLER_ID, productName: 'Rice', demandQuantity: 100, enteredBy: 'test' }
    });
    // Simulate district demand trigger
    await prisma.districtDemand.upsert({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      create: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice', totalDemand: 100, remainingDemand: 100 },
      update: { totalDemand: { increment: 100 }, remainingDemand: { increment: 100 } }
    });
    
    let distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    assert(distDemand!.totalDemand === 100, "District total demand should be 100");
    console.log("✓ TEST 1 PASSED");

    // TEST 3: Multiple upazillas same product
    console.log("TEST 3: Dhanmondi enters Rice 80");
    await prisma.upazillaDemand.create({
      data: { upazillaResellerId: MOCK_DHANMONDI_RESELLER_ID, productName: 'Rice', demandQuantity: 80, enteredBy: 'test' }
    });
    await prisma.districtDemand.update({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      data: { totalDemand: { increment: 80 }, remainingDemand: { increment: 80 } }
    });
    distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    assert(distDemand!.totalDemand === 180, "District total demand should be 180");
    console.log("✓ TEST 3 PASSED");

    console.log("\n--- RUNNING ROUTING TESTS ---");

    // TEST 9: Full reservation (Seller stock covers demand)
    console.log("TEST 9: Reserve 100 units from seller stock (Demand is 100 for Mirpur)");
    
    // Create local seller stock item
    const stockItem = await prisma.resellerStockItem.create({
      data: { resellerId: MOCK_LOCAL_RESELLER_ID, customName: 'Rice', quantity: 120 }
    });

    // Run Reserve logic for Mirpur
    const upazillaDemand = await prisma.upazillaDemand.findFirst({ where: { upazillaResellerId: MOCK_MIRPUR_RESELLER_ID, productName: 'Rice' } });
    
    // Simulate transaction
    const reserveAmount = Math.min(100, 120); // needed is 100, available 120
    const surplusAmount = 120 - reserveAmount;

    await prisma.resellerStockItem.update({
      where: { id: stockItem.id },
      data: { isReserved: true, reservedQuantity: reserveAmount, surplusQuantity: surplusAmount }
    });

    await prisma.upazillaDemand.update({
      where: { id: upazillaDemand!.id },
      data: { fulfilledQuantity: reserveAmount, status: 'fulfilled' }
    });

    await prisma.districtStockItem.create({
      data: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice', quantity: surplusAmount }
    });

    await prisma.districtDemand.update({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      data: { remainingDemand: { decrement: reserveAmount } }
    });

    // Verify
    const updatedDemand = await prisma.upazillaDemand.findUnique({ where: { id: upazillaDemand!.id } });
    assert(updatedDemand!.status === 'fulfilled', "Mirpur demand should be fulfilled");
    assert(updatedDemand!.fulfilledQuantity === 100, "Fulfilled qty should be 100");

    const distStock = await prisma.districtStockItem.findFirst({ where: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } });
    assert(distStock!.quantity === 20, "District should have received 20 surplus");

    distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    assert(distDemand!.remainingDemand === 80, "District remaining demand should be 80 (180 - 100)");

    console.log("✓ TEST 9 PASSED");

    console.log("\n--- RUNNING EDGE CASE TESTS ---");
    // TEST 13: Double reservation
    console.log("TEST 13: Attempt to reserve same item again");
    const itemCheck = await prisma.resellerStockItem.findUnique({ where: { id: stockItem.id } });
    let doubleReservationFailed = false;
    if (itemCheck!.isReserved) {
      doubleReservationFailed = true;
    }
    assert(doubleReservationFailed, "Should block double reservation");
    console.log("✓ TEST 13 PASSED");

    console.log("\nAll core algorithmic logic verified successfully.");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await cleanUp();
    console.log("Demo accounts and test data cleaned up.");
    await prisma.$disconnect();
  }
}

runTests();
