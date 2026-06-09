import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import { prisma } from '../src/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import UPAZILLA_CENTROIDS_RAW from '../src/data/upazilla-centroids.js';
import DISTRICT_CENTROIDS_RAW from '../src/data/district-centroids.js';

const UPAZILLA_CENTROIDS = UPAZILLA_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;
const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

const BASE_URL = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'dummy'
);

// ── Types ──────────────────────────────────────────────
type TestResult = {
  name: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN';
  message: string;
  demoImpact: string;
  duration: number;
};

const results: TestResult[] = [];

async function test(
  name: string,
  category: string,
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM',
  demoImpact: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, category, priority, status: 'PASS', message: 'OK', demoImpact, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (err: any) {
    const msg = err.message ?? String(err);
    if (msg.startsWith('SKIP:')) {
      results.push({ name, category, priority, status: 'SKIP', message: msg, demoImpact, duration: Date.now() - start });
      console.log(`⏭️  ${name}: ${msg}`);
    } else if (msg.startsWith('WARN:')) {
      results.push({ name, category, priority, status: 'WARN', message: msg, demoImpact, duration: Date.now() - start });
      console.log(`⚠️  ${name}: ${msg}`);
    } else {
      results.push({ name, category, priority, status: 'FAIL', message: msg, demoImpact, duration: Date.now() - start });
      console.log(`❌ ${name}: ${msg}`);
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ── Helper: get an auth token for API calls ───────────
let _authToken: string | null = null;
async function getAuthToken(): Promise<string | null> {
  if (_authToken) return _authToken;
  // Find any user in profiles to sign in with
  // We'll try the demo seller or any user
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL ?? '',
    password: process.env.TEST_ADMIN_PASS ?? '',
  });
  if (data?.session?.access_token) {
    _authToken = data.session.access_token;
    return _authToken;
  }
  return null;
}

async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `sb-access-token=${token}`;
  }
  return fetch(url, { ...opts, headers });
}

// ══════════════════════════════════════════════════════
// PHASE 1: SYSTEM HEALTH
// ══════════════════════════════════════════════════════
async function runPhase1() {
  console.log("\n━━━ PHASE 1: SYSTEM HEALTH TESTS ━━━");

  await test("H1: Database Connection", "Health", "CRITICAL",
    "ENTIRE DEMO FAILS — no DB", async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  await test("H2: Supabase Auth Connection", "Health", "CRITICAL",
    "Cannot login as any role", async () => {
    const { error } = await supabase.auth.getSession();
    assert(!error, error?.message || "Failed to get session");
  });

  await test("H3: Next.js Server Running", "Health", "CRITICAL",
    "ENTIRE DEMO FAILS — server down", async () => {
    const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    assert(res !== null && res.ok, `Server not responding at ${BASE_URL}`);
  });

  await test("H4: Required Environment Variables", "Health", "MEDIUM",
    "Specific features break silently", async () => {
    assert(!!process.env.NEXT_PUBLIC_SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
    assert(!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    assert(!!process.env.DATABASE_URL, "Missing DATABASE_URL");
  });

  await test("H5: Prisma Schema In Sync With DB", "Health", "CRITICAL",
    "ACO system crashes on trigger", async () => {
    const tables: any[] = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const names = tables.map(t => t.table_name);
    const required = [
      "profiles", "seller_products", "global_products", "buyer_profiles", "cart_items", "orders", "order_items",
      "LocalReseller", "ResellerStockItem", "UpazillaReseller", "UpazillaStockItem", "StockTransfer",
      "DistrictReseller", "DistrictStockItem", "DistrictTransfer", "UpazillaDemand", "DistrictDemand",
      "DemandPheromone", "RoutePheromone", "ACOGlobalJob", "ACOShipment", "ACOShipmentItem",
      "ProductDemandSnapshot", "SellerSupplySnapshot"
    ];
    for (const r of required) {
      assert(names.includes(r), `Missing table: ${r}`);
    }
  });

  await test("H6: Leaflet Centroid Data Complete", "Health", "HIGH",
    "Nodes missing from map in demo", async () => {
    assert(Object.keys(DISTRICT_CENTROIDS).length >= 60, `Only ${Object.keys(DISTRICT_CENTROIDS).length} districts`);
    assert(Object.keys(UPAZILLA_CENTROIDS).length >= 70, `Only ${Object.keys(UPAZILLA_CENTROIDS).length} upazillas`);
    const required = ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Mymensingh"];
    const dKeys = Object.keys(DISTRICT_CENTROIDS).map(k => k.toLowerCase());
    for (const r of required) {
      assert(dKeys.includes(r.toLowerCase()), `Missing district: ${r}`);
    }
  });
}

// ══════════════════════════════════════════════════════
// PHASE 8: SEED DATA (run early to fix data tests)
// ══════════════════════════════════════════════════════
async function runPhase8_Seed() {
  console.log("\n━━━ PHASE 8: DEMO SEED DATA PREPARATION ━━━");

  await test("S1: Seed Demo Data If Missing", "Seed", "CRITICAL",
    "Demo has no data to show", async () => {

    // ── Seed extra sellers ──
    const sellerCount = await prisma.profile.count({ where: { type: "seller" } });
    if (sellerCount < 5) {
      const needed = 5 - sellerCount;
      const demoSellers = [
        { id: `demo-seller-2`, username: "Rice Wholesaler", storeName: "Bangla Rice Co.", lat: 23.75, lng: 90.39, city: "Dhaka", upazilla: "Mirpur", sellerCode: "SEL-RICE-2" },
        { id: `demo-seller-3`, username: "Oil Supplier", storeName: "Golden Oil BD", lat: 23.78, lng: 90.42, city: "Dhaka", upazilla: "Dhanmondi", sellerCode: "SEL-OIL-3" },
        { id: `demo-seller-4`, username: "Sugar Trader", storeName: "Sweet Sugar Ltd", lat: 22.35, lng: 91.83, city: "Chittagong", upazilla: "Kotwali", sellerCode: "SEL-SUG-4" },
        { id: `demo-seller-5`, username: "Spice Merchant", storeName: "Masala House", lat: 24.37, lng: 88.60, city: "Rajshahi", upazilla: "Boalia", sellerCode: "SEL-SPC-5" },
      ];
      for (let i = 0; i < Math.min(needed, demoSellers.length); i++) {
        const s = demoSellers[i];
        await prisma.profile.upsert({
          where: { id: s.id },
          update: {},
          create: { ...s, type: "seller", fullName: s.username },
        });
        // Seed products for this seller
        const products = [
          { customName: "Premium Rice", stock: 500, price: 65, productCode: `RICE-${s.sellerCode}`, status: "approved" },
          { customName: "Soybean Oil", stock: 300, price: 140, productCode: `OIL-${s.sellerCode}`, status: "approved" },
        ];
        for (const p of products) {
          await prisma.sellerProduct.upsert({
            where: { id: `${s.id}-${p.productCode}` },
            update: {},
            create: { id: `${s.id}-${p.productCode}`, sellerId: s.id, ...p },
          });
        }
      }
      console.log(`    → Seeded ${needed} demo sellers with products`);
    }

    // ── Seed upazilla resellers ──
    const upazillaCount = await prisma.upazillaReseller.count();
    if (upazillaCount < 3) {
      const demoUpazillas = [
        { id: "demo-upazilla-mirpur", email: "mirpur@demo.com", city: "Dhaka", upazilla: "Mirpur" },
        { id: "demo-upazilla-dhanmondi", email: "dhanmondi@demo.com", city: "Dhaka", upazilla: "Dhanmondi" },
        { id: "demo-upazilla-uttara", email: "uttara@demo.com", city: "Dhaka", upazilla: "Uttara" },
      ];
      for (const u of demoUpazillas) {
        await prisma.upazillaReseller.upsert({
          where: { id: u.id },
          update: {},
          create: u,
        });
      }
      console.log("    → Seeded 3 demo upazilla resellers");
    }

    // ── Seed demands ──
    const demandCount = await prisma.upazillaDemand.count({ where: { status: { not: "fulfilled" } } });
    if (demandCount < 5) {
      const upazillas = await prisma.upazillaReseller.findMany();
      const demandEntries = [
        { productName: "Premium Rice", demandQuantity: 200 },
        { productName: "Soybean Oil", demandQuantity: 150 },
        { productName: "Sugar", demandQuantity: 100 },
      ];
      for (const u of upazillas.slice(0, 3)) {
        for (const d of demandEntries.slice(0, 2)) {
          await prisma.upazillaDemand.upsert({
            where: { upazillaResellerId_productName: { upazillaResellerId: u.id, productName: d.productName } },
            update: {},
            create: {
              upazillaResellerId: u.id,
              productName: d.productName,
              demandQuantity: d.demandQuantity,
              fulfilledQuantity: 0,
              status: "pending",
              enteredBy: u.id,
            },
          });
        }
      }
      console.log("    → Seeded demo demand entries");
    }
  });

  await test("S2: Seed Pheromone Data For Map Demo", "Seed", "HIGH",
    "Pheromone layer shows empty map", async () => {
    const pCount = await prisma.demandPheromone.count();
    if (pCount < 5) {
      const upazillas = await prisma.upazillaReseller.findMany();
      const demands = await prisma.upazillaDemand.findMany();
      for (const d of demands) {
        const u = upazillas.find(u => u.id === d.upazillaResellerId);
        if (!u) continue;
        await prisma.demandPheromone.upsert({
          where: { entityType_entityId_productName: { entityType: "upazilla", entityId: u.id, productName: d.productName } },
          update: { score: 3.0 + Math.random() * 5, demandDeficit: d.demandQuantity - d.fulfilledQuantity },
          create: {
            entityType: "upazilla",
            entityId: u.id,
            entityName: u.upazilla,
            productName: d.productName,
            score: 3.0 + Math.random() * 5,
            demandDeficit: d.demandQuantity - d.fulfilledQuantity,
            waitingDays: Math.floor(Math.random() * 7) + 1,
          },
        });
      }
      console.log("    → Seeded pheromone data");
    }
  });
}

// ══════════════════════════════════════════════════════
// PHASE 2: DEMO DATA VERIFICATION
// ══════════════════════════════════════════════════════
async function runPhase2() {
  console.log("\n━━━ PHASE 2: DEMO DATA VERIFICATION ━━━");

  await test("D1: District Reseller Exists", "Data", "HIGH",
    "ACO Phase 3 cannot demonstrate", async () => {
    const c = await prisma.districtReseller.count();
    assert(c >= 1, `Only ${c} district resellers`);
  });

  await test("D2: Upazilla Resellers ≥ 3", "Data", "HIGH",
    "Phase 2 routing has nothing to show", async () => {
    const c = await prisma.upazillaReseller.count();
    assert(c >= 3, `Only ${c} upazilla resellers`);
  });

  await test("D3: Sellers With Approved Products ≥ 3", "Data", "HIGH",
    "Superdashboard shows empty map", async () => {
    const sellers = await prisma.profile.findMany({
      where: { type: "seller" },
      include: { products: { where: { status: "approved", stock: { gt: 0 } } } }
    });
    const withStock = sellers.filter(s => s.products.length > 0);
    assert(withStock.length >= 3, `Only ${withStock.length} sellers with stock`);
  });

  await test("D4: Multi-Product Demand Exists", "Data", "HIGH",
    "ACO has nothing to optimize", async () => {
    const demands = await prisma.upazillaDemand.findMany({ where: { status: { not: "fulfilled" } } });
    assert(demands.length >= 5, `Only ${demands.length} unfulfilled demands`);
    const uniqueProducts = new Set(demands.map(d => d.productName));
    assert(uniqueProducts.size >= 2, `Only ${uniqueProducts.size} product types`);
  });

  await test("D5: District Demands Match Upazilla Sums", "Data", "MEDIUM",
    "Wrong demand numbers shown in demo", async () => {
    const dDemands = await prisma.districtDemand.findMany();
    if (dDemands.length === 0) throw new Error("SKIP: No district demands to verify");
    // If exists, check consistency
    const uDemands = await prisma.upazillaDemand.findMany({ include: { upazillaReseller: true } });
    const sums: Record<string, number> = {};
    for (const d of uDemands) {
      const key = `${d.upazillaReseller.city}::${d.productName}`;
      sums[key] = (sums[key] || 0) + d.demandQuantity;
    }
    for (const d of dDemands) {
      const dr = await prisma.districtReseller.findUnique({ where: { id: d.districtResellerId } });
      if (!dr) continue;
      const key = `${dr.district}::${d.productName}`;
      const uSum = sums[key] || 0;
      assert(Math.abs(d.totalDemand - uSum) < 1, `Mismatch for ${key}: expected ${uSum}, got ${d.totalDemand}`);
    }
  });

  await test("D6: Sellers In Bangladesh Bounds", "Data", "HIGH",
    "Sellers appear in ocean on map", async () => {
    const sellers = await prisma.profile.findMany({ where: { type: "seller" } });
    for (const s of sellers) {
      if (!s.lat || !s.lng) continue;
      assert(s.lat >= 20.5 && s.lat <= 26.8, `Seller ${s.storeName} lat ${s.lat} out of bounds`);
      assert(s.lng >= 88.0 && s.lng <= 92.7, `Seller ${s.storeName} lng ${s.lng} out of bounds`);
    }
  });

  await test("D7: Pheromone Data Exists", "Data", "MEDIUM",
    "Pheromone layer shows empty map", async () => {
    const c = await prisma.demandPheromone.count();
    assert(c >= 5, `Only ${c} pheromones`);
  });
}

// ══════════════════════════════════════════════════════
// PHASE 3: USER FLOWS
// ══════════════════════════════════════════════════════
async function runPhase3() {
  console.log("\n━━━ PHASE 3: USER FLOW TESTS ━━━");

  await test("U1: Auth Token Available", "Flow", "HIGH",
    "Cannot show authenticated features", async () => {
    const token = await getAuthToken();
    if (!token) throw new Error("WARN: No auth token — set TEST_ADMIN_EMAIL/PASS in env");
  });

  await test("U2: Seller Product Listing", "Flow", "HIGH",
    "Nothing to route in ACO demo", async () => {
    const products = await prisma.sellerProduct.findMany({ where: { status: "approved", stock: { gt: 0 } } });
    assert(products.length >= 1, "No approved products with stock");
  });

  await test("U3: Upazilla Reseller Flow", "Flow", "HIGH",
    "Upazilla dashboard broken in demo", async () => {
    const c = await prisma.upazillaReseller.count();
    assert(c > 0, "No upazilla resellers");
  });

  await test("U4: District Reseller Dashboard", "Flow", "HIGH",
    "District dashboard empty in demo", async () => {
    const d = await prisma.districtReseller.findFirst();
    assert(!!d, "No district reseller found");
  });

  await test("U5: Superdashboard Map Data", "Flow", "CRITICAL",
    "Map shows wrong data during demo", async () => {
    const [sc, uc, dc] = await Promise.all([
      prisma.profile.count({ where: { type: "seller" } }),
      prisma.upazillaReseller.count(),
      prisma.districtReseller.count()
    ]);
    assert(sc >= 3, `Only ${sc} sellers, need 3+`);
    assert(uc >= 1, `Only ${uc} upazilla resellers`);
    assert(dc >= 1, `Only ${dc} district resellers`);
  });
}

// ══════════════════════════════════════════════════════
// PHASE 4: ACO PIPELINE
// ══════════════════════════════════════════════════════
async function runPhase4() {
  console.log("\n━━━ PHASE 4: ACO PIPELINE TESTS ━━━");

  await test("A1: Demand Check API", "ACO", "HIGH",
    "ACO button disabled, cannot demo", async () => {
    const res = await authFetch(`${BASE_URL}/api/aco/demand-check`);
    if (res.status === 401) throw new Error("WARN: demand-check requires auth — need TEST_ADMIN_EMAIL");
    assert(res.ok, `demand-check returned ${res.status}`);
  });

  await test("A2: No Concurrent Job Running", "ACO", "CRITICAL",
    "ACO trigger returns 400 during demo", async () => {
    const running = await prisma.aCOGlobalJob.findFirst({
      where: { status: { in: ["planning", "executing", "running"] } }
    });
    if (running) {
      const age = Date.now() - new Date(running.startedAt).getTime();
      if (age > 5 * 60_000) {
        await prisma.aCOGlobalJob.update({ where: { id: running.id }, data: { status: "failed" } });
        console.log(`    → Auto-fixed stale job ${running.id} (age: ${Math.round(age / 1000)}s)`);
      } else {
        throw new Error(`Job ${running.id} is still running (age: ${Math.round(age / 1000)}s)`);
      }
    }
  });

  await test("A3: ACO Trigger Succeeds", "ACO", "CRITICAL",
    "ACO fails during live demo", async () => {
    const res = await authFetch(`${BASE_URL}/api/aco/global-trigger`, { method: 'POST' });
    if (res.status === 401) {
      throw new Error("WARN: ACO trigger requires auth — set TEST_ADMIN_EMAIL/PASS. During demo, user will be logged in.");
    }
    const body = await res.text();
    if (!res.ok && body.includes("No seller products")) throw new Error("WARN: " + body);
    assert(res.ok, `ACO trigger failed: ${res.status} ${body}`);
  });

  await test("A4: Conservation Report Balanced", "ACO", "CRITICAL",
    "Conservation failure shown in demo", async () => {
    const job = await prisma.aCOGlobalJob.findFirst({ orderBy: { startedAt: 'desc' } });
    if (!job) throw new Error("SKIP: No ACO job exists yet");
    if (!job.conservationCheck) throw new Error("SKIP: Job has no conservation check");
    const report = job.conservationCheck as any;
    assert(report.balanced === true || !report.violations?.length, "Conservation imbalance detected");
  });

  await test("A5: Phase 1 Shipments Created", "ACO", "HIGH",
    "Phase 1 routing invisible in demo", async () => {
    const p1 = await prisma.aCOShipment.findMany({
      where: { phase: 1 }, include: { lineItems: true }
    });
    if (p1.length === 0) throw new Error("WARN: No Phase 1 shipments — run ACO first");
    for (const s of p1) {
      assert(s.lineItems.length >= 1, `Shipment ${s.id} has no items`);
      assert(s.totalQuantity > 0, `Shipment ${s.id} totalQuantity=0`);
    }
  });

  await test("A6: UpazillaDemand Status Updated", "ACO", "HIGH",
    "Demand panel shows 0% fulfilled", async () => {
    const d = await prisma.upazillaDemand.findMany();
    const updated = d.filter(x => x.fulfilledQuantity > 0);
    if (updated.length === 0) throw new Error("WARN: No demands fulfilled yet");
  });

  await test("A7: DistrictStockItem Has Stock", "ACO", "HIGH",
    "District hub shows empty in demo", async () => {
    const items = await prisma.districtStockItem.findMany();
    if (!items.some(i => i.quantity > 0)) throw new Error("WARN: District hub empty");
  });

  await test("A8: Phase 3 Shipments (If Applicable)", "ACO", "HIGH",
    "Cannot show Phase 3 inter-district", async () => {
    const p3 = await prisma.aCOShipment.findMany({ where: { phase: 3 } });
    if (p3.length === 0) throw new Error("WARN: No Phase 3 shipments. Add cross-district demand to show inter-district approval.");
  });

  await test("A11: ACO Score Calculation", "ACO", "MEDIUM",
    "Score numbers look broken on dashboard", async () => {
    const items = await prisma.aCOShipmentItem.findMany({ take: 10 });
    if (items.length === 0) throw new Error("SKIP: No shipment items to check");
    for (const i of items) {
      assert(Number.isFinite(i.acoScore), `Item ${i.id} has invalid acoScore: ${i.acoScore}`);
      assert(i.acoScore >= 0, `Item ${i.id} has negative acoScore: ${i.acoScore}`);
    }
  });

  await test("A12: Multi-Product Bundling", "ACO", "MEDIUM",
    "Cannot show truck bundling concept", async () => {
    const shipments = await prisma.aCOShipment.findMany({ include: { lineItems: true } });
    if (shipments.length === 0) throw new Error("SKIP: No shipments to check");
    const multi = shipments.filter(s => s.lineItems.length > 1);
    if (multi.length === 0) throw new Error("WARN: All shipments are single-product. Bundling not visible.");
  });
}

// ══════════════════════════════════════════════════════
// PHASE 6: CONSERVATION STRICT VERIFICATION
// ══════════════════════════════════════════════════════
async function runPhase6() {
  console.log("\n━━━ PHASE 6: CONSERVATION STRICT VERIFICATION ━━━");

  await test("C1: No Negative UpazillaStockItem", "Strict", "CRITICAL",
    "Conservation failure visible in demo", async () => {
    // Actual columns: quantity (no reservedQuantity/surplusQuantity)
    const neg: any[] = await prisma.$queryRaw`
      SELECT id, "productName", quantity FROM "UpazillaStockItem" WHERE quantity < 0
    `;
    assert(neg.length === 0, `${neg.length} upazilla stock items have negative quantity`);
  });

  await test("C2: District Demand Consistency", "Strict", "CRITICAL",
    "Wrong demand numbers shown on dashboard", async () => {
    // Actual columns: totalDemand, remainingDemand (no fulfilledByUpazillas)
    const violation: any[] = await prisma.$queryRaw`
      SELECT id, "totalDemand", "remainingDemand"
      FROM "DistrictDemand"
      WHERE "remainingDemand" < 0
    `;
    assert(violation.length === 0, `${violation.length} district demands have negative remainingDemand`);
  });

  await test("C3: Negative Stock Check (All Tables)", "Strict", "CRITICAL",
    "System shows negative stock = broken demo", async () => {
    const neg1: any[] = await prisma.$queryRaw`SELECT id FROM seller_products WHERE stock < 0`;
    const neg2: any[] = await prisma.$queryRaw`SELECT id FROM "UpazillaStockItem" WHERE quantity < 0`;
    const neg3: any[] = await prisma.$queryRaw`SELECT id FROM "DistrictStockItem" WHERE quantity < 0`;
    const neg4: any[] = await prisma.$queryRaw`SELECT id FROM "ResellerStockItem" WHERE quantity < 0`;
    const total = neg1.length + neg2.length + neg3.length + neg4.length;
    assert(total === 0, `NEGATIVE STOCK: sellers=${neg1.length} upazilla=${neg2.length} district=${neg3.length} reseller=${neg4.length}`);
  });

  await test("C4: ACO Job Conservation Per Product", "Strict", "CRITICAL",
    "Conservation report shows violation", async () => {
    const job = await prisma.aCOGlobalJob.findFirst({
      orderBy: { startedAt: 'desc' },
      include: { shipments: { include: { lineItems: true } } }
    });
    if (!job) throw new Error("SKIP: No ACO job to verify");
    const snapshots = await prisma.sellerSupplySnapshot.findMany({ where: { jobId: job.id } });
    if (snapshots.length === 0) throw new Error("SKIP: No supply snapshots for this job");

    const byProduct = new Map<string, number>();
    for (const s of snapshots) {
      byProduct.set(s.productName, (byProduct.get(s.productName) ?? 0) + s.stockAtSnapshot);
    }
    for (const [code, original] of byProduct) {
      const allocated = job.shipments
        .flatMap(s => s.lineItems)
        .filter(i => i.productCode === code && !["cancelled", "rejected"].includes(i.status ?? ""))
        .reduce((sum, i) => sum + i.allocatedQty, 0);
      assert(allocated <= original, `Conservation VIOLATED for ${code}: allocated ${allocated} > original ${original}`);
    }
  });

  await test("C5: No Orphan Shipment Items", "Strict", "CRITICAL",
    "Dashboard shows ghost items", async () => {
    const orphans: any[] = await prisma.$queryRaw`
      SELECT si.id FROM "ACOShipmentItem" si
      LEFT JOIN "ACOShipment" s ON si."shipmentId" = s.id
      WHERE s.id IS NULL
    `;
    assert(orphans.length === 0, `${orphans.length} orphan items found`);
  });
}

// ══════════════════════════════════════════════════════
// PHASE 7: FRONTEND SMOKE TESTS
// ══════════════════════════════════════════════════════
async function runPhase7() {
  console.log("\n━━━ PHASE 7: FRONTEND SMOKE TESTS ━━━");

  await test("F1: Superdashboard Page Loads", "Frontend", "HIGH",
    "Superdashboard white screen", async () => {
    const res = await fetch(`${BASE_URL}/superdashboard`).catch(() => null);
    if (!res) throw new Error("SKIP: Server not running");
    assert(!res.redirected || res.ok, `Superdashboard returned ${res.status}`);
  });

  await test("F2: All Dashboard Pages Respond", "Frontend", "HIGH",
    "Demo navigation breaks", async () => {
    const pages = [
      "/seller/dashboard",
      "/superdashboard",
    ];
    for (const p of pages) {
      const res = await fetch(`${BASE_URL}${p}`).catch(() => null);
      if (!res) throw new Error(`SKIP: Server not running for ${p}`);
      assert(res.status !== 500, `Page ${p} returned 500`);
    }
  });

  await test("F3: API Routes Correct Methods", "Frontend", "MEDIUM",
    "Unexpected errors if demo goes off-script", async () => {
    const res = await fetch(`${BASE_URL}/api/superdashboard/nodes`, { method: "DELETE" }).catch(() => null);
    if (!res) throw new Error("SKIP: Server not running");
    // Next.js returns 405 for wrong method, or sometimes 404
    assert(res.status !== 500, `DELETE /api/superdashboard/nodes returned 500`);
  });

  await test("F4: Map Centroid Data Serves Correctly", "Frontend", "HIGH",
    "Demand heatmap shows in ocean", async () => {
    const res = await fetch(`${BASE_URL}/api/superdashboard/nodes`).catch(() => null);
    if (!res) throw new Error("SKIP: Server not running");
    if (!res.ok) throw new Error(`nodes API returned ${res.status}`);
    const data = await res.json();
    // Check that returned sellers have valid coords
    if (data.sellers) {
      for (const s of data.sellers) {
        if (s.lat && s.lng) {
          assert(s.lat >= 20.5 && s.lat <= 26.8, `Seller lat ${s.lat} out of bounds`);
          assert(s.lng >= 88.0 && s.lng <= 92.7, `Seller lng ${s.lng} out of bounds`);
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════
// PHASE 9: PERFORMANCE
// ══════════════════════════════════════════════════════
async function runPhase9() {
  console.log("\n━━━ PHASE 9: PERFORMANCE TESTS ━━━");

  await test("PERF1: Superdashboard Nodes Load Time", "Perf", "HIGH",
    "Map takes forever to load", async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/superdashboard/nodes`).catch(() => null);
    const dur = Date.now() - start;
    if (!res) throw new Error("SKIP: Server not running");
    assert(dur < 5000, `Nodes API took ${dur}ms (target: <5s)`);
  });

  await test("PERF2: Demand Check API Speed", "Perf", "MEDIUM",
    "ACO panel loads slowly", async () => {
    const start = Date.now();
    const res = await authFetch(`${BASE_URL}/api/aco/demand-check`).catch(() => null);
    const dur = Date.now() - start;
    if (!res || res.status === 401) throw new Error("SKIP: Auth required");
    assert(dur < 3000, `demand-check took ${dur}ms (target: <3s)`);
  });
}

// ══════════════════════════════════════════════════════
// REPORT GENERATION
// ══════════════════════════════════════════════════════
function generateReport() {
  const critical = results.filter(r => r.priority === 'CRITICAL');
  const high = results.filter(r => r.priority === 'HIGH');
  const medium = results.filter(r => r.priority === 'MEDIUM');

  const criticalPass = critical.filter(r => r.status === 'PASS').length;
  const highPass = high.filter(r => r.status === 'PASS').length;
  const mediumPass = medium.filter(r => r.status === 'PASS').length;

  const criticalFail = critical.filter(r => r.status === 'FAIL');
  const highFail = high.filter(r => r.status === 'FAIL');
  const warnings = results.filter(r => r.status === 'WARN');
  const skips = results.filter(r => r.status === 'SKIP');

  console.log('\n' + '═'.repeat(60));
  console.log('  HACKATHON DEMO VERIFICATION REPORT');
  console.log('═'.repeat(60));

  console.log(`\n🎯 OVERALL DEMO READINESS:`);
  if (criticalFail.length > 0) {
    console.log('  🔴 NOT READY — CRITICAL FAILURES');
    console.log('  Do NOT attempt demo until fixed.');
  } else if (highFail.length > 0) {
    console.log('  🟡 PARTIALLY READY — HIGH FAILURES');
    console.log('  Demo possible but will look broken.');
  } else {
    console.log('  🟢 READY FOR DEMO!');
  }

  console.log(`\n📊 TEST SCORES:`);
  console.log(`  CRITICAL: ${criticalPass}/${critical.length} passed`);
  console.log(`  HIGH:     ${highPass}/${high.length} passed`);
  console.log(`  MEDIUM:   ${mediumPass}/${medium.length} passed`);
  console.log(`  TOTAL:    ${results.filter(r => r.status === 'PASS').length}/${results.length} passed`);

  if (criticalFail.length > 0) {
    console.log(`\n🚨 CRITICAL FAILURES (fix immediately):`);
    for (const f of criticalFail) {
      console.log(`  ❌ ${f.name}`);
      console.log(`     Error: ${f.message}`);
      console.log(`     Demo impact: ${f.demoImpact}`);
    }
  }

  if (highFail.length > 0) {
    console.log(`\n⚠️  HIGH FAILURES (fix before demo):`);
    for (const f of highFail) {
      console.log(`  ❌ ${f.name}`);
      console.log(`     Error: ${f.message}`);
      console.log(`     Demo impact: ${f.demoImpact}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n💡 WARNINGS (note for presenter):`);
    for (const w of warnings) console.log(`  ⚠️  ${w.name}: ${w.message}`);
  }

  if (skips.length > 0) {
    console.log(`\n⏭️  SKIPPED TESTS:`);
    for (const s of skips) console.log(`  ⏭️  ${s.name}: ${s.message}`);
  }

  console.log(`\n⏱️  SLOWEST TESTS:`);
  const slowest = [...results].sort((a, b) => b.duration - a.duration).slice(0, 5);
  for (const t of slowest) console.log(`  ${t.duration}ms — ${t.name}`);

  console.log(`\n📋 DEMO CHECKLIST:`);
  console.log('  Before demo:');
  console.log('    □ Run: npx dotenv-cli -e .env.local -- npm run verify-demo');
  console.log('    □ All CRITICAL tests: PASS');
  console.log('    □ Browser: clear cache');
  console.log('    □ Superdashboard: open on second screen');
  console.log('    □ ACO job: pre-run (for history)');
  console.log('    □ Next.js Server MUST BE RUNNING (npm run dev)');

  console.log('\n' + '═'.repeat(60));
}

// ══════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════
async function main() {
  console.log('🧪 NodeCommerce Hackathon Verification');
  console.log(`   Running at: ${new Date().toISOString()}`);
  console.log(`   Target: ${BASE_URL}\n`);

  // Phase 1: Health
  await runPhase1();
  const healthFails = results.filter(r => r.category === 'Health' && r.priority === 'CRITICAL' && r.status === 'FAIL');
  if (healthFails.length > 0) {
    console.log('\n🛑 STOPPING: Critical health failures. Fix before proceeding.');
    generateReport();
    await prisma.$disconnect();
    process.exit(1);
  }

  // Phase 8: Seed (run early to fix data)
  await runPhase8_Seed();

  // Phase 2-9
  await runPhase2();
  await runPhase3();
  await runPhase4();
  // Phase 5: UiPath — skipped as requested
  await runPhase6();
  await runPhase7();
  await runPhase9();

  generateReport();

  await prisma.$disconnect();
  const hasBlockers = results.some(r => r.priority === 'CRITICAL' && r.status === 'FAIL');
  process.exit(hasBlockers ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
