import { prisma } from '../src/lib/prisma';
import { randomUUID } from 'crypto';

// Import Route Handlers
import { POST as ReservePost } from '../src/app/api/routing/reserve/route';
import { POST as SurplusPost } from '../src/app/api/routing/surplus/route';
import { POST as UpazillaDemandPost } from '../src/app/api/demand/upazilla/route';
import { POST as DistrictDemandPost } from '../src/app/api/demand/district/route';
import { POST as DistrictTransferPost } from '../src/app/api/district-reseller/transfer/route';
import { PATCH as UpazillaTransferPatch } from '../src/app/api/upazilla-reseller/district-transfers/route';

// Mocks
const MOCK_MIRPUR_ID = 'test-mirpur-' + randomUUID();
const MOCK_DHANMONDI_ID = 'test-dhanmondi-' + randomUUID();
const MOCK_CHITTAGONG_ID = 'test-chittagong-' + randomUUID();
const MOCK_DHAKA_DISTRICT_ID = 'test-dhaka-' + randomUUID();
const MOCK_LOCAL_RESELLER_ID = 'test-local-reseller-' + randomUUID();
const MOCK_BUYER_ID = 'test-buyer-' + randomUUID();

const setAuth = (id: string | null) => {
  (globalThis as any).__TEST_USER_ID__ = id;
};

const createRequest = (body: any) => {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
};

const extractResponse = async (res: Response) => {
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

async function setupDB() {
  const UNIQUE_DISTRICT = 'Kushtia';
  const UNIQUE_CTGG = 'Dhaka';

  // Users
  await prisma.districtReseller.create({ data: { id: MOCK_DHAKA_DISTRICT_ID, email: 'dhaka@test.com', district: UNIQUE_DISTRICT } });
  
  await prisma.upazillaReseller.create({ data: { id: MOCK_MIRPUR_ID, email: 'mirpur@test.com', city: UNIQUE_DISTRICT, upazilla: 'Mirpur' } });
  await prisma.upazillaReseller.create({ data: { id: MOCK_DHANMONDI_ID, email: 'dhanmondi@test.com', city: UNIQUE_DISTRICT, upazilla: 'Bheramara' } });
  await prisma.upazillaReseller.create({ data: { id: MOCK_CHITTAGONG_ID, email: 'ctg@test.com', city: UNIQUE_CTGG, upazilla: 'Dhamrai' } });

  await prisma.localReseller.create({ data: { id: MOCK_LOCAL_RESELLER_ID, email: 'local@test.com', username: 'TestLocal', city: UNIQUE_DISTRICT, upazilla: 'Mirpur', resellerCode: 'TX99' } });
  
  await prisma.buyerProfile.create({ data: { id: MOCK_BUYER_ID, fullName: 'Buyer', email: 'buyer@test.com', phone: '017' } });

  return UNIQUE_DISTRICT;
}

async function cleanDB() {
  await prisma.upazillaDemand.deleteMany();
  await prisma.districtDemand.deleteMany();
  await prisma.resellerStockItem.deleteMany();
  await prisma.districtStockItem.deleteMany();
  await prisma.districtTransfer.deleteMany();
  await prisma.upazillaStockItem.deleteMany();

  await prisma.localReseller.deleteMany({ where: { id: MOCK_LOCAL_RESELLER_ID } });
  await prisma.upazillaReseller.deleteMany({ where: { id: { in: [MOCK_MIRPUR_ID, MOCK_DHANMONDI_ID, MOCK_CHITTAGONG_ID] } } });
  await prisma.districtReseller.deleteMany({ where: { id: MOCK_DHAKA_DISTRICT_ID } });
  await prisma.buyerProfile.deleteMany({ where: { id: MOCK_BUYER_ID } });
}

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    if (details) console.error(JSON.stringify(details, null, 2));
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log("Setting up DB...");
  await cleanDB();
  const districtName = await setupDB();

  try {
    // ==========================================
    // TEST 23 — Concurrent reservation race condition
    // ==========================================
    console.log("\n--- TEST 23: Concurrent Reservation Race Condition ---");
    const stock23 = await prisma.resellerStockItem.create({ data: { resellerId: MOCK_LOCAL_RESELLER_ID, customName: 'RaceRice', quantity: 100 } });
    await prisma.upazillaDemand.create({ data: { upazillaResellerId: MOCK_MIRPUR_ID, productName: 'RaceRice', demandQuantity: 80, enteredBy: 'test' } });
    
    setAuth(MOCK_MIRPUR_ID);
    const [res23a, res23b] = await Promise.all([
      ReservePost(createRequest({ stockItemId: stock23.id, productName: 'RaceRice', availableQuantity: 100 })).then(extractResponse),
      ReservePost(createRequest({ stockItemId: stock23.id, productName: 'RaceRice', availableQuantity: 100 })).then(extractResponse)
    ]);

    const successRes = res23a.status === 200 ? res23a : res23b;
    const errorRes = res23a.status === 400 ? res23a : res23b;
    
    assert(successRes.status === 200, "One request should succeed", successRes);
    assert(errorRes.status === 400, "Other request should return 400", errorRes);
    assert(errorRes.data?.error?.includes("already been processed"), "Error should indicate already processed");

    const upzDemand23 = await prisma.upazillaDemand.findFirst({ where: { productName: 'RaceRice' } });
    assert(upzDemand23!.fulfilledQuantity === 80, "Fulfilled quantity should be exactly 80", upzDemand23);

    const distStock23 = await prisma.districtStockItem.findFirst({ where: { productName: 'RaceRice' } });
    assert(distStock23!.quantity === 20, "District stock should be exactly 20", distStock23);


    // ==========================================
    // TEST 24 — Auth boundary validation
    // ==========================================
    console.log("\n--- TEST 24: Auth Boundaries ---");
    
    // Test A
    setAuth(MOCK_MIRPUR_ID);
    const t24a = await extractResponse(await UpazillaDemandPost(createRequest({ upazillaResellerId: MOCK_DHANMONDI_ID, productName: 'Test', demandQuantity: 10 })));
    assert(t24a.status === 403, "Test 24A: Wrong upazilla ownership", t24a);

    // Test C (Upazilla calls district)
    setAuth(MOCK_MIRPUR_ID);
    const t24c = await extractResponse(await DistrictDemandPost(createRequest({ districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Test', totalDemand: 10 })));
    assert(t24c.status === 403, "Test 24C: Upazilla reseller calls district API", t24c);

    // Test D (Buyer calls routing)
    setAuth(MOCK_BUYER_ID);
    const t24d = await extractResponse(await ReservePost(createRequest({ stockItemId: stock23.id, productName: 'RaceRice', availableQuantity: 100 })));
    assert(t24d.status === 403, "Test 24D: Buyer calls routing", t24d);

    // Test E (Unauth)
    setAuth("UNAUTH");
    const t24e = await extractResponse(await ReservePost(createRequest({ stockItemId: stock23.id, productName: 'RaceRice', availableQuantity: 100 })));
    assert(t24e.status === 401, "Test 24E: Unauthenticated call", t24e);

    // Test F (District transfer cross-district)
    setAuth(MOCK_DHAKA_DISTRICT_ID);
    const t24f = await extractResponse(await DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_CHITTAGONG_ID, sourceStockItemId: distStock23!.id, quantity: 10 })));
    assert(t24f.status === 403, "Test 24F: Transfer to wrong district", t24f);


    // ==========================================
    // TEST 25 — Case insensitive product matching
    // ==========================================
    console.log("\n--- TEST 25: Case Insensitive Matching ---");
    
    // Test A
    await prisma.upazillaDemand.create({ data: { upazillaResellerId: MOCK_MIRPUR_ID, productName: 'rice lower', demandQuantity: 50, enteredBy: 'test' } });
    const stock25 = await prisma.resellerStockItem.create({ data: { resellerId: MOCK_LOCAL_RESELLER_ID, customName: 'Rice Lower', quantity: 60 } });
    
    setAuth(MOCK_MIRPUR_ID);
    const t25a = await extractResponse(await ReservePost(createRequest({ stockItemId: stock25.id, productName: 'Rice Lower', availableQuantity: 60 })));
    assert(t25a.status === 200, "Test 25A: Reserve lowercase demand with title case stock", t25a);
    assert(t25a.data.reservedQuantity === 50, "Should reserve 50");
    
    const distStock25 = await prisma.districtStockItem.findFirst({ where: { productName: 'Rice Lower' } });
    assert(!!distStock25, "Test 25A: District stock preserves casing", distStock25);


    // ==========================================
    // TEST 26-30 — Bridge API Tests
    // ==========================================
    console.log("\n--- TEST 26-30: Bridge API Tests ---");
    
    // Setup for 26
    const distStock26 = await prisma.districtStockItem.create({ data: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'BridgeItem', quantity: 50 } });
    await prisma.districtDemand.create({ data: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'BridgeItem', totalDemand: 100, remainingDemand: 30 } });

    // TEST 26 - Happy path
    setAuth(MOCK_DHAKA_DISTRICT_ID);
    const t26 = await extractResponse(await DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_MIRPUR_ID, sourceStockItemId: distStock26.id, quantity: 20 })));
    assert(t26.status === 200, "Test 26: Happy path transfer", t26);
    assert(t26.data.remainingStock === 30, "Test 26: Remaining stock = 30", t26.data);

    // TEST 28 - Duplicate pending block
    const t28 = await extractResponse(await DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_MIRPUR_ID, sourceStockItemId: distStock26.id, quantity: 10 })));
    assert(t28.status === 400 && t28.data.error.includes("already exists"), "Test 28: Blocks duplicate pending transfer", t28);

    // TEST 27 - Concurrent atomic stock check
    const distStock27 = await prisma.districtStockItem.create({ data: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'BridgeAtomic', quantity: 10 } });
    const [t27a, t27b] = await Promise.all([
      DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_MIRPUR_ID, sourceStockItemId: distStock27.id, quantity: 8 })).then(extractResponse),
      // Need different upazilla otherwise Test 28 duplicate block catches it instead of stock check
      DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_DHANMONDI_ID, sourceStockItemId: distStock27.id, quantity: 8 })).then(extractResponse)
    ]);
    const success27 = t27a.status === 200 ? t27a : t27b;
    const error27 = t27a.status === 400 ? t27a : t27b;
    assert(success27.status === 200 && error27.status === 400, "Test 27: Atomic check blocks over-deduction");
    assert(error27.data.error.includes("Stock became insufficient"), "Test 27: Correct error message");
    
    const finalStock27 = await prisma.districtStockItem.findUnique({ where: { id: distStock27.id }});
    assert(finalStock27!.quantity === 2, "Test 27: Remaining stock should be 2");

    // TEST 29 & 30 - Accept/Reject Updates
    // Reject
    const transfer29 = await prisma.districtTransfer.findFirst({ where: { upazillaResellerId: MOCK_MIRPUR_ID, productName: 'BridgeItem', status: 'pending' } });
    setAuth(MOCK_MIRPUR_ID);
    const patchReq = new Request(`http://localhost/api/upazilla-reseller/district-transfers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transferId: transfer29!.id, action: 'reject' }) });
    const t29 = await extractResponse(await UpazillaTransferPatch(patchReq));
    assert(t29.status === 200, "Test 29: Reject transfer");
    
    const distStock29 = await prisma.districtStockItem.findUnique({ where: { id: distStock26.id }});
    assert(distStock29!.quantity === 50, "Test 29: Restores stock to 50");

    // Accept (Test 30)
    setAuth(MOCK_DHAKA_DISTRICT_ID);
    const t30setup = await extractResponse(await DistrictTransferPost(createRequest({ upazillaResellerId: MOCK_MIRPUR_ID, sourceStockItemId: distStock26.id, quantity: 30 })));
    const transfer30Id = t30setup.data.transfer.id;

    setAuth(MOCK_MIRPUR_ID);
    const patchReq30 = new Request(`http://localhost/api/upazilla-reseller/district-transfers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transferId: transfer30Id, action: 'accept' }) });
    const t30 = await extractResponse(await UpazillaTransferPatch(patchReq30));
    assert(t30.status === 200, "Test 30: Accept transfer");

    const demand30 = await prisma.districtDemand.findFirst({ where: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'BridgeItem' } });
    assert(demand30!.remainingDemand === 0, "Test 30: districtDemand remainingDemand goes to 0", demand30);
    
    const upzStock30 = await prisma.upazillaStockItem.findFirst({ where: { upazillaResellerId: MOCK_MIRPUR_ID, productName: 'BridgeItem' } });
    assert(upzStock30!.quantity === 30, "Test 30: Upazilla Stock increases by 30", upzStock30);

    console.log("\n✅ ALL 23-30 EDGE CASE TESTS PASSED SUCCESSFULLY.");

  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
  } finally {
    await cleanDB();
    console.log("DB Cleaned up.");
  }
}

runTests();
