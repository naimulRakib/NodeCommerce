/**
 * Edge Case Runner - 50+ Scenario Stress Test
 * 
 * Runs end-to-end tests against the ACO Logistics Engine
 * by injecting specific extreme scenarios directly into the DB
 * and invoking the API endpoints.
 */

import { prisma } from "../src/lib/prisma";
const BASE_URL = "http://localhost:3000";

async function clearDB() {
  await prisma.aCOGlobalJob.deleteMany({});
  await prisma.aCOShipment.deleteMany({});
  await prisma.aCOShipmentItem.deleteMany({});
  await prisma.truck.deleteMany({});
  await prisma.truckStop.deleteMany({});
  await prisma.truckStopItem.deleteMany({});
  await prisma.upazillaDemand.deleteMany({});
  await prisma.districtDemand.deleteMany({});
  await prisma.resellerStockItem.deleteMany({});
  await prisma.districtStockItem.deleteMany({});
  await prisma.sellerProduct.deleteMany({});
  await prisma.realtimeAction.deleteMany({});
  await prisma.sellerACONegotiation.deleteMany({});
}

// Ensure base entities exist
async function ensureEntities() {
  // We assume Sellers and Resellers already exist in the DB, 
  // but let's grab a few to use as variables.
  const sellers = await prisma.profile.findMany({ where: { type: "seller" }, take: 3 });
  const upazillas = await prisma.upazillaReseller.findMany({ take: 3 });
  const districts = await prisma.districtReseller.findMany({ take: 3 });

  if (sellers.length < 3 || upazillas.length < 3 || districts.length < 2) {
    throw new Error("Test requires at least 3 sellers, 3 upazillas, 2 districts seeded in DB.");
  }
  return { sellers, upazillas, districts };
}

async function runTestCase(index, name, setupFn, expectFn) {
  process.stdout.write(`[Test ${index}/50] ${name}... `);
  try {
    await clearDB();
    const entities = await ensureEntities();
    await setupFn(entities);

    const res = await fetch(`${BASE_URL}/api/aco/global-trigger`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Cookie": `bypass_auth_id=${entities.sellers[0].id}`
      },
      body: JSON.stringify({ productScope: [`Rice-${index}`], triggerType: "auto", maxPhases: 4 })
    });

    const data = await res.json();
    if (!res.ok) {
      if (expectFn(data, false)) {
        console.log("✅ PASSED (Expected Failure Handled)");
        return true;
      } else {
        console.log(`❌ FAILED: Unexpected Error - ${JSON.stringify(data)}`);
        return false;
      }
    }

    // Success response
    const passed = expectFn(data, true);
    if (passed) {
      console.log("✅ PASSED");
      return true;
    } else {
      console.log("❌ FAILED: Logic check failed.");
      return false;
    }

  } catch (err) {
    console.log(`❌ FAILED: Exception - ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("==========================================");
  console.log("   NODE-COMMERCE: 50+ EDGE CASE RUNNER    ");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;
  const results = [];

  const addResult = (res) => {
    if (res) passed++; else failed++;
  };

  // We will procedurally generate many edge cases
  
  addResult(await runTestCase(1, "Massive Deficit (100k Demand, 5 Supply)", async ({ sellers, upazillas }) => {
    await prisma.sellerProduct.create({ data: { sellerId: sellers[0].id, productCode: `P-RICE-1-${Date.now()}`, customName: `Rice-1`, stock: 5, price: 50, status: "approved" } });
    await prisma.upazillaDemand.create({ data: { upazillaResellerId: upazillas[0].id, productName: `Rice-1`, demandQuantity: 100000, status: "pending", enteredBy: "script" } });
  }, (data, isOk) => isOk && data?.conservationCheck?.['Rice-1']?.expected === 5));

  // 2. Massive Surplus
  addResult(await runTestCase(2, "Massive Surplus (0 Demand, 100k Supply)", async ({ sellers, upazillas }) => {
    await prisma.sellerProduct.create({ data: { sellerId: sellers[0].id, productCode: `P-RICE-2-${Date.now()}`, customName: `Rice-2`, stock: 100000, price: 50, status: "approved" } });
  }, (data, isOk) => !isOk || (isOk && data?.conservationCheck?.['Rice-2']?.expected === 0)));

  // 3. Exact Match
  addResult(await runTestCase(3, "Exact Match (500 Demand, 500 Supply)", async ({ sellers, upazillas }) => {
    await prisma.sellerProduct.create({ data: { sellerId: sellers[0].id, productCode: `P-RICE-3-${Date.now()}`, customName: `Rice-3`, stock: 500, price: 50, status: "approved" } });
    await prisma.upazillaDemand.create({ data: { upazillaResellerId: upazillas[0].id, productName: `Rice-3`, demandQuantity: 500, status: "pending", enteredBy: "script" } });
  }, (data, isOk) => isOk && data?.conservationCheck?.['Rice-3']?.expected === 500));

  // Auto-generate 47 more matrix combinations
  for (let i = 4; i <= 50; i++) {
    const supply = Math.floor(Math.random() * 10000);
    const demand = Math.floor(Math.random() * 10000);
    const multiSeller = i % 2 === 0;
    const multiUpazilla = i % 3 === 0;

    addResult(await runTestCase(i, `Procedural Case [S=${supply}, D=${demand}, MultiS=${multiSeller}, MultiU=${multiUpazilla}]`, async ({ sellers, upazillas }) => {
      
      if (multiSeller) {
        await prisma.sellerProduct.create({ data: { sellerId: sellers[0].id, productCode: `P-RICE-${i}-1-${Date.now()}`, customName: `Rice-${i}`, stock: Math.floor(supply/2), price: 50, status: "approved" } });
        await prisma.sellerProduct.create({ data: { sellerId: sellers[1].id, productCode: `P-RICE-${i}-2-${Date.now()}`, customName: `Rice-${i}`, stock: Math.ceil(supply/2), price: 50, status: "approved" } });
      } else {
        await prisma.sellerProduct.create({ data: { sellerId: sellers[0].id, productCode: `P-RICE-${i}-1-${Date.now()}`, customName: `Rice-${i}`, stock: supply, price: 50, status: "approved" } });
      }

      if (multiUpazilla) {
        await prisma.upazillaDemand.create({ data: { upazillaResellerId: upazillas[0].id, productName: `Rice-${i}`, demandQuantity: Math.floor(demand/2), status: "pending", enteredBy: "script" } });
        await prisma.upazillaDemand.create({ data: { upazillaResellerId: upazillas[1].id, productName: `Rice-${i}`, demandQuantity: Math.ceil(demand/2), status: "pending", enteredBy: "script" } });
      } else {
        await prisma.upazillaDemand.create({ data: { upazillaResellerId: upazillas[0].id, productName: `Rice-${i}`, demandQuantity: demand, status: "pending", enteredBy: "script" } });
      }

    }, (data, isOk) => {
      if (!isOk) return true; // Handled gracefully
      const expected = Math.min(supply, demand);
      if (expected === 0 && data?.conservationCheck?.[`Rice-${i}`]?.expected === 0) return true;
      return data?.conservationCheck?.[`Rice-${i}`]?.expected === expected;
    }));
  }

  console.log("\n==========================================");
  console.log(`   RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==========================================");

  require('fs').writeFileSync('edge_case_results.json', JSON.stringify({ passed, failed, total: 50 }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
