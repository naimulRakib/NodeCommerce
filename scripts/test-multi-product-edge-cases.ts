// @ts-nocheck
/**
 * test-multi-product-edge-cases.ts
 * =================================
 * Five edge-case scenarios for the Multi-Product Global ACO
 * engine. Pure-function tests — no DB writes. Each scenario
 * builds a synthetic input, runs the engine, and asserts the
 * conservation invariants from the spec.
 *
 * Run with: npx tsx scripts/test-multi-product-edge-cases.ts
 *
 * Edge cases covered
 * ------------------
 *  1. Conservation per product across all phases
 *     (rice, oil, sugar each balance to original stock;
 *      no cross-product contamination).
 *  2. Float precision in proportional Phase 3 allocation
 *     (floor() loses 1 unit; remainder must go to top district
 *      so no product loses a unit).
 *  3. Phase 3 partially approved / rejected / expired —
 *     conservation must hold for all products.
 *  4. Same product from two sellers in same district —
 *     per-seller tracking (not just per-product).
 *  5. Phase 4 exact-fit conservation (received == distributed).
 */
import {
  planPhase1,
  planPhase2,
  planPhase3,
  planPhase4,
  verifyMultiProductConservation,
  buildShipmentPlans,
  type ProductSupply,
  type UpazillaDemandEntry,
  type DistrictDemandEntry,
  type PlanLineItem,
  type ShipmentPlan,
} from "../src/lib/aco-multi-engine";

// ============================================================
// Minimal in-memory test harness
// ============================================================
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertEq(actual: any, expected: any, msg: string) {
  if (actual === expected) {
    console.log(`  ✓ ${msg} (got ${actual})`);
    passed++;
  } else {
    console.log(`  ✗ ${msg} (expected ${expected}, got ${actual})`);
    failed++;
    failures.push(msg);
  }
}

function header(title: string) {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

const coords = {
  Mirpur: { lat: 23.8069, lng: 90.3687 },
  Dhanmondi: { lat: 23.7461, lng: 90.3742 },
  Agrabad: { lat: 22.3273, lng: 91.8138 },
  Pahartali: { lat: 22.3543, lng: 91.7833 },
  Kotwali: { lat: 22.3398, lng: 91.8403 },
  ChittagongHub: { lat: 22.33, lng: 91.81 },
  DhakaHub: { lat: 23.78, lng: 90.41 },
};

// ============================================================
// EDGE CASE 1 — Conservation per product across all phases
// ============================================================
async function edgeCase1() {
  header("EDGE CASE 1 — Per-product conservation across all phases");

  // Seller A supplies 1000 rice, 500 oil, 300 sugar from Mirpur, Dhaka
  const supplies: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 1000,
    },
    {
      productName: "Oil",
      productCode: "OIL01",
      sellerProductId: "sp-oil",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 500,
    },
    {
      productName: "Sugar",
      productCode: "SUG01",
      sellerProductId: "sp-sugar",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 300,
    },
  ];

  // Upazilla demands across 3 products, all in Dhaka
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 1000,
      reservedDemand: 0,
      effectiveDeficit: 1000,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Oil",
      pendingDemand: 500,
      reservedDemand: 0,
      effectiveDeficit: 500,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Sugar",
      pendingDemand: 300,
      reservedDemand: 0,
      effectiveDeficit: 300,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
  ];

  // Phase 1: seller → own upazilla
  // We need the engine to know that supply belongs to upz-mirpur.
  // planPhase1 reads (supply as any).ownUpazillaResellerId.
  const suppliesWithOwner = supplies.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) =>
      u === "Mirpur" ? coords.Mirpur : { lat: 23.7, lng: 90.4 },
  });

  // Bundle all p1 line items into one shipment per (seller, dest)
  const p1Shipments: ShipmentPlan[] = p1.shipments;
  // p1 should have one shipment bundling all 3 products
  assert(p1Shipments.length >= 1, "Phase 1 produced at least one shipment");
  const p1Items = p1Shipments.flatMap((s) => s.lineItems);
  const p1Totals: Record<string, number> = {};
  for (const li of p1Items) {
    p1Totals[li.productName] =
      (p1Totals[li.productName] ?? 0) + li.allocatedQty;
  }
  assertEq(p1Totals.Rice, 1000, "Phase 1 rice = 1000");
  assertEq(p1Totals.Oil, 500, "Phase 1 oil = 500");
  assertEq(p1Totals.Sugar, 300, "Phase 1 sugar = 300");

  // Verify cross-product contamination
  for (const li of p1Items) {
    assert(
      li.productName === "Rice" || li.productName === "Oil" || li.productName === "Sugar",
      `Phase 1 line item is a valid product (${li.productName})`
    );
  }

  // Verify per-productCode alignment
  for (const li of p1Items) {
    const expectedCode =
      li.productName === "Rice"
        ? "RICE01"
        : li.productName === "Oil"
        ? "OIL01"
        : "SUG01";
    assert(li.productCode === expectedCode, `productCode matches for ${li.productName}`);
  }

  // Conservation per product
  const result = verifyMultiProductConservation({
    supplySnapshots: supplies.map((s) => ({
      sellerProductId: s.sellerProductId!,
      productName: s.productName,
      stockAtSnapshot: s.available,
    })),
    shipmentLineItems: p1Items.map((li) => ({
      productName: li.productName,
      allocatedQty: li.allocatedQty,
      status: "executed",
    })),
  });

  assert(result.balanced, "Conservation: balanced (no over-allocation)");
  assertEq(result.perProduct.Rice?.discrepancy, 0, "Rice discrepancy = 0");
  assertEq(result.perProduct.Oil?.discrepancy, 0, "Oil discrepancy = 0");
  assertEq(result.perProduct.Sugar?.discrepancy, 0, "Sugar discrepancy = 0");
}

// ============================================================
// EDGE CASE 2 — Float precision: floor loses 1 unit
// ============================================================
async function edgeCase2() {
  header("EDGE CASE 2 — Float precision in proportional allocation");

  // 100kg surplus of each product, two districts with non-round scores.
  // A naive floor-based proportional split loses 1 unit per product.
  // The fix: distribute the remainder to the highest-scoring district.
  const surplus = 100;
  const scoreA = 7.33333;
  const scoreB = 6.66666;
  const totalScore = scoreA + scoreB;
  const ratioA = scoreA / totalScore; // 0.5238...
  const ratioB = scoreB / totalScore; // 0.4761...

  // Naive floor approach
  const naiveA = Math.floor(surplus * ratioA); // 52
  const naiveB = Math.floor(surplus * ratioB); // 47
  const naiveTotal = naiveA + naiveB; // 99 — LOST 1
  assertEq(naiveTotal, 99, "Naive floor approach loses 1 unit");

  // Correct approach: largest remainder method (Hamilton's method).
  // Allocates the leftover unit(s) to the bucket with the LARGEST fractional
  // remainder, not necessarily the highest absolute weight.
  //
  // For weights 7.33333 and 6.66666 over total=100:
  //   A exact = 52.381, floor 52, remainder 0.381
  //   B exact = 47.619, floor 47, remainder 0.619  ← larger remainder wins
  // So the mathematically correct split is A=52, B=48, total=100.
  function largestRemainder(
    total: number,
    weights: number[]
  ): number[] {
    const sumW = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map((w) => (total * w) / sumW);
    const floors = exact.map((x) => Math.floor(x));
    const remainders = exact.map((x, i) => ({ i, rem: x - floors[i] }));
    let leftover = total - floors.reduce((a, b) => a + b, 0);
    remainders.sort((a, b) => b.rem - a.rem);
    const out = [...floors];
    for (let k = 0; k < leftover; k++) out[remainders[k].i] += 1;
    return out;
  }

  const [correctA, correctB] = largestRemainder(surplus, [scoreA, scoreB]);
  assertEq(correctA + correctB, 100, "Largest remainder method preserves total");
  // 0.619 > 0.381, so B (smaller weight) gets the leftover +1
  assertEq(correctA, 52, "A gets 52 (largest remainder goes to B)");
  assertEq(correctB, 48, "B gets 48 (largest remainder wins +1)");

  // Apply the same fix to all three products
  const products = ["RICE01", "OIL01", "SUG01"];
  for (const prod of products) {
    const [a, b] = largestRemainder(surplus, [scoreA, scoreB]);
    assertEq(a + b, 100, `${prod}: no unit lost`);
    assertEq(a, 52, `${prod}: A = 52`);
    assertEq(b, 48, `${prod}: B = 48`);
  }

  // Verify conservation across the 3 products when bundled into
  // a single shipment each
  const result = verifyMultiProductConservation({
    supplySnapshots: [
      { sellerProductId: "sp-rice", productName: "Rice", stockAtSnapshot: 100 },
      { sellerProductId: "sp-oil", productName: "Oil", stockAtSnapshot: 100 },
      { sellerProductId: "sp-sugar", productName: "Sugar", stockAtSnapshot: 100 },
    ],
    shipmentLineItems: [
      { productName: "Rice", allocatedQty: 52, status: "executed" },
      { productName: "Rice", allocatedQty: 48, status: "executed" },
      { productName: "Oil", allocatedQty: 52, status: "executed" },
      { productName: "Oil", allocatedQty: 48, status: "executed" },
      { productName: "Sugar", allocatedQty: 52, status: "executed" },
      { productName: "Sugar", allocatedQty: 48, status: "executed" },
    ],
  });
  assert(result.balanced, "Multi-product conservation: balanced");
  assertEq(result.perProduct.Rice?.discrepancy, 0, "Rice discrepancy = 0");
  assertEq(result.perProduct.Oil?.discrepancy, 0, "Oil discrepancy = 0");
  assertEq(result.perProduct.Sugar?.discrepancy, 0, "Sugar discrepancy = 0");
}

// ============================================================
// EDGE CASE 3 — Phase 3 partially approved / rejected / expired
// ============================================================
async function edgeCase3() {
  header("EDGE CASE 3 — Phase 3 partial outcomes, conservation holds");

  // Initial supply at Dhaka hub: 350 rice, 300 oil, 200 sugar
  const initialSupply = { Rice: 350, Oil: 300, Sugar: 200 };

  // Three Phase 3 shipments:
  //   X: Rice 200 + Oil 100  -> Chittagong  (BOTH approved → executed)
  //   Y: Rice 150 + Sugar 80 -> Sylhet      (target REJECTED → cancelled)
  //   Z: Oil 200 + Sugar 120  -> Rajshahi   (EXPIRED → cancelled)
  const shipments = [
    {
      id: "ship-X",
      status: "executed",
      lineItems: [
        { productName: "Rice", allocatedQty: 200, status: "executed" },
        { productName: "Oil", allocatedQty: 100, status: "executed" },
      ],
    },
    {
      id: "ship-Y",
      status: "cancelled",
      lineItems: [
        { productName: "Rice", allocatedQty: 150, status: "cancelled" },
        { productName: "Sugar", allocatedQty: 80, status: "cancelled" },
      ],
    },
    {
      id: "ship-Z",
      status: "cancelled",
      lineItems: [
        { productName: "Oil", allocatedQty: 200, status: "cancelled" },
        { productName: "Sugar", allocatedQty: 120, status: "cancelled" },
      ],
    },
  ];

  // Only X is executed. The hub should still hold:
  //   Rice: 350 - 200 = 150  (Y's 150 was never deducted)
  //   Oil:  300 - 100 = 200  (Z's 200 was never deducted)
  //   Sugar: 200 - 0   = 200 (Y's 80 + Z's 120 were never deducted)
  const allItems = shipments.flatMap((s) => s.lineItems);
  const result = verifyMultiProductConservation({
    supplySnapshots: [
      {
        sellerProductId: "sp-rice",
        productName: "Rice",
        stockAtSnapshot: initialSupply.Rice,
      },
      {
        sellerProductId: "sp-oil",
        productName: "Oil",
        stockAtSnapshot: initialSupply.Oil,
      },
      {
        sellerProductId: "sp-sugar",
        productName: "Sugar",
        stockAtSnapshot: initialSupply.Sugar,
      },
    ],
    shipmentLineItems: allItems.map((li) => ({
      productName: li.productName,
      allocatedQty: li.allocatedQty,
      status: li.status,
    })),
  });
  assert(result.balanced, "Conservation balanced when Y/Z cancelled");
  assertEq(result.perProduct.Rice?.actual, 200, "Rice actually executed = 200 (X only)");
  assertEq(result.perProduct.Oil?.actual, 100, "Oil actually executed = 100 (X only)");
  assertEq(result.perProduct.Sugar?.actual, 0, "Sugar actually executed = 0");

  // Hub stock after Y/Z cancellation: stock - executed only
  const remaining = {
    Rice: initialSupply.Rice - (result.perProduct.Rice?.actual ?? 0),
    Oil: initialSupply.Oil - (result.perProduct.Oil?.actual ?? 0),
    Sugar: initialSupply.Sugar - (result.perProduct.Sugar?.actual ?? 0),
  };
  assertEq(remaining.Rice, 150, "Hub rice remaining = 150");
  assertEq(remaining.Oil, 200, "Hub oil remaining = 200");
  assertEq(remaining.Sugar, 200, "Hub sugar remaining = 200");

  // Verify: Y's rice and Z's oil were NEVER deducted (because cancelled
  // line items are excluded from the actual sum)
  assert(
    allItems.find((li) => li.productName === "Rice" && li.status === "cancelled"),
    "Shipment Y rice is marked cancelled"
  );
  assert(
    allItems.find((li) => li.productName === "Oil" && li.status === "cancelled"),
    "Shipment Z oil is marked cancelled"
  );
}

// ============================================================
// EDGE CASE 4 — Two sellers, same product, same district
// ============================================================
async function edgeCase4() {
  header("EDGE CASE 4 — Two sellers, same product, per-seller tracking");

  // Seller A (Mirpur): Rice 400
  // Seller B (Dhanmondi): Rice 600
  // Total Rice in Dhaka: 1000
  const supplies: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-A-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 400,
    },
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-B-rice",
      sellerId: "seller-B",
      district: "Dhaka",
      upazilla: "Dhanmondi",
      available: 600,
    },
  ];

  // Per-seller upazilla demands
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 400,
      reservedDemand: 0,
      effectiveDeficit: 400,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-dhanmondi",
      upazilla: "Dhanmondi",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 600,
      reservedDemand: 0,
      effectiveDeficit: 600,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Dhanmondi.lat,
      lng: coords.Dhanmondi.lng,
    },
  ];

  // Mark each supply with its own upazilla owner
  const suppliesWithOwner = [
    { ...supplies[0], ownUpazillaResellerId: "upz-mirpur" },
    { ...supplies[1], ownUpazillaResellerId: "upz-dhanmondi" },
  ];

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) =>
      u === "Mirpur" ? coords.Mirpur : coords.Dhanmondi,
  });

  const p1Items = p1.shipments.flatMap((s) => s.lineItems);
  // Group by sellerProductId
  const bySeller: Record<string, number> = {};
  for (const li of p1Items) {
    bySeller[li.sellerProductId!] =
      (bySeller[li.sellerProductId!] ?? 0) + li.allocatedQty;
  }
  assertEq(bySeller["sp-A-rice"] ?? 0, 400, "Seller A rice allocation = 400");
  assertEq(bySeller["sp-B-rice"] ?? 0, 600, "Seller B rice allocation = 600");
  assertEq(
    (bySeller["sp-A-rice"] ?? 0) + (bySeller["sp-B-rice"] ?? 0),
    1000,
    "Combined = 1000"
  );

  // Per-seller conservation
  const result = verifyMultiProductConservation({
    supplySnapshots: [
      {
        sellerProductId: "sp-A-rice",
        productName: "Rice",
        stockAtSnapshot: 400,
      },
      {
        sellerProductId: "sp-B-rice",
        productName: "Rice",
        stockAtSnapshot: 600,
      },
    ],
    shipmentLineItems: p1Items.map((li) => ({
      productName: li.productName,
      allocatedQty: li.allocatedQty,
      status: "executed",
    })),
  });
  // The current verifier aggregates by productName only.
  // For per-seller strict tracking, we'd need to break out by
  // sellerProductId — flag the gap here:
  assert(
    result.perProduct.Rice?.expected === 1000,
    "Aggregate expected = 1000 (per-product sum works)"
  );
  assert(result.balanced, "Aggregate conservation balanced");
  // Per-seller strict check: the system must NOT have deducted
  // Seller B's stock to satisfy Seller A's demand
  assert(
    bySeller["sp-A-rice"] === 400,
    "Seller A stock tracked independently (not commingled)"
  );
  assert(
    bySeller["sp-B-rice"] === 600,
    "Seller B stock tracked independently (not commingled)"
  );
}

// ============================================================
// EDGE CASE 5 — Phase 4 exact-fit conservation
// ============================================================
async function edgeCase5() {
  header("EDGE CASE 5 — Phase 4 exact-fit, no leftover / overflow");

  // Dhaka delivers to Chittagong: Rice 300, Oil 200
  const arrivingLineItems: PlanLineItem[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      allocatedQty: 300,
      acoScore: 0.5,
      distanceKm: 0,
      demandAtTime: 0,
      pheromoneScore: 0.5,
      allocationReason: "inter_district_aco",
    },
    {
      productName: "Oil",
      productCode: "OIL01",
      allocatedQty: 200,
      acoScore: 0.5,
      distanceKm: 0,
      demandAtTime: 0,
      pheromoneScore: 0.5,
      allocationReason: "inter_district_aco",
    },
  ];

  // Chittagong upazilla demands: rice 150+100+50=300, oil 100+80+20=200
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-agrabad",
      upazilla: "Agrabad",
      district: "Chittagong",
      productName: "Rice",
      pendingDemand: 150,
      reservedDemand: 0,
      effectiveDeficit: 150,
      waitingDays: 1,
      pheromoneScore: 0.7,
      lat: coords.Agrabad.lat,
      lng: coords.Agrabad.lng,
    },
    {
      upazillaResellerId: "upz-agrabad",
      upazilla: "Agrabad",
      district: "Chittagong",
      productName: "Oil",
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.7,
      lat: coords.Agrabad.lat,
      lng: coords.Agrabad.lng,
    },
    {
      upazillaResellerId: "upz-pahartali",
      upazilla: "Pahartali",
      district: "Chittagong",
      productName: "Rice",
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Pahartali.lat,
      lng: coords.Pahartali.lng,
    },
    {
      upazillaResellerId: "upz-pahartali",
      upazilla: "Pahartali",
      district: "Chittagong",
      productName: "Oil",
      pendingDemand: 80,
      reservedDemand: 0,
      effectiveDeficit: 80,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Pahartali.lat,
      lng: coords.Pahartali.lng,
    },
    {
      upazillaResellerId: "upz-kotwali",
      upazilla: "Kotwali",
      district: "Chittagong",
      productName: "Rice",
      pendingDemand: 50,
      reservedDemand: 0,
      effectiveDeficit: 50,
      waitingDays: 1,
      pheromoneScore: 0.3,
      lat: coords.Kotwali.lat,
      lng: coords.Kotwali.lng,
    },
    {
      upazillaResellerId: "upz-kotwali",
      upazilla: "Kotwali",
      district: "Chittagong",
      productName: "Oil",
      pendingDemand: 20,
      reservedDemand: 0,
      effectiveDeficit: 20,
      waitingDays: 1,
      pheromoneScore: 0.3,
      lat: coords.Kotwali.lat,
      lng: coords.Kotwali.lng,
    },
  ];

  const p4 = planPhase4({
    arrivingLineItems,
    arrivingAtDistrict: "Chittagong",
    arrivingAtHubId: "hub-chittagong",
    districtDemands: [],
    upazillaDemands,
    intraDistrictFillsByKey: {},
    getUpazillaCoords: (u) => {
      const map: Record<string, { lat: number; lng: number }> = {
        Agrabad: coords.Agrabad,
        Pahartali: coords.Pahartali,
        Kotwali: coords.Kotwali,
      };
      return map[u] ?? { lat: 22.33, lng: 91.81 };
    },
  });

  // Sum up Phase 4 allocations
  const riceTotal = p4.shipments
    .flatMap((s) => s.lineItems)
    .filter((li) => li.productName === "Rice")
    .reduce((s, li) => s + li.allocatedQty, 0);
  const oilTotal = p4.shipments
    .flatMap((s) => s.lineItems)
    .filter((li) => li.productName === "Oil")
    .reduce((s, li) => s + li.allocatedQty, 0);

  assertEq(riceTotal, 300, "Phase 4 rice = 300 (exact fit)");
  assertEq(oilTotal, 200, "Phase 4 oil = 200 (exact fit)");

  // Chittagong hub should be at 0 (no stock left over)
  const riceUnallocated = p4.unallocated.Rice ?? 0;
  const oilUnallocated = p4.unallocated.Oil ?? 0;
  assertEq(riceUnallocated, 0, "Chittagong hub rice = 0 after Phase 4");
  assertEq(oilUnallocated, 0, "Chittagong hub oil = 0 after Phase 4");

  // Conservation: what arrived in Phase 3 == what Phase 4 distributed
  const result = verifyMultiProductConservation({
    supplySnapshots: [
      {
        sellerProductId: "p3-truck",
        productName: "Rice",
        stockAtSnapshot: 300,
      },
      {
        sellerProductId: "p3-truck",
        productName: "Oil",
        stockAtSnapshot: 200,
      },
    ],
    shipmentLineItems: p4.shipments
      .flatMap((s) => s.lineItems)
      .map((li) => ({
        productName: li.productName,
        allocatedQty: li.allocatedQty,
        status: "executed",
      })),
  });
  assert(result.balanced, "Phase 4 → Phase 3 conservation balanced");
  assertEq(result.perProduct.Rice?.discrepancy, 0, "Rice 0 discrepancy");
  assertEq(result.perProduct.Oil?.discrepancy, 0, "Oil 0 discrepancy");
}

// ============================================================
// EDGE CASE 6 — Same seller, same dest, two products
// in two passes — bundling correctness
// ============================================================
async function edgeCase6() {
  header("EDGE CASE 6 — Same seller/dest bundling across phases");

  // Two supplies from Seller A to the same Mirpur upazilla.
  // Phase 1 only ships to OWN upazilla and emits one shipment
  // per (seller, product) tuple — NOT bundled across products.
  // Real bundling only happens at the district/district level
  // (Phase 2 / Phase 3 / Phase 4). This test asserts both:
  //   6a) Phase 1 emits one shipment per product (engine behaviour)
  //   6b) Phase 3's truckBuilder correctly merges two products
  //       on the same (sourceHub -> targetDistrict) truck.

  // ---- 6a) Phase 1 same-seller-same-upazilla ----
  const supplies: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 200,
    },
    {
      productName: "Oil",
      productCode: "OIL01",
      sellerProductId: "sp-oil",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 100,
    },
  ];
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 200,
      reservedDemand: 0,
      effectiveDeficit: 200,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Oil",
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
  ];

  const suppliesWithOwner = supplies.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) => coords[u] ?? coords.Mirpur,
  });

  // Phase 1: per the engine source (lines 444-468) each supply
  // creates a single ShipmentPlan with [lineItem]. So 2 supplies
  // -> 2 shipments, even though they share (seller, upazilla).
  // The bundling is deferred to the hub/district phases.
  assertEq(p1.shipments.length, 2, "Phase 1: 2 shipments (one per product)");
  const p1Products = p1.shipments
    .flatMap((s) => s.lineItems)
    .map((li) => li.productName)
    .sort();
  assert(p1Products.includes("Rice") && p1Products.includes("Oil"),
    "Phase 1: both Rice and Oil are shipped");

  // ---- 6b) Phase 3 bundles two products on one truck ----
  // Two supplies from the same Dhaka hub, both targeting Chittagong.
  // The truckBuilder keyed by `${sourceHubId}::${targetDistrictId}`
  // should merge them into ONE shipment with TWO line items.
  const suppliesP3: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 300,
    },
    {
      productName: "Oil",
      productCode: "OIL01",
      sellerProductId: "sp-oil",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 200,
    },
  ];
  const suppliesP3WithHub = suppliesP3.map((s) => ({
    ...s,
    hubDistrictResellerId: "hub-dhaka",
  }));
  const districtDemands: DistrictDemandEntry[] = [
    {
      districtResellerId: "hub-chittagong",
      district: "Chittagong",
      productName: "Rice",
      pendingDemand: 300,
      reservedDemand: 0,
      effectiveDeficit: 300,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.ChittagongHub.lat,
      lng: coords.ChittagongHub.lng,
    },
    {
      districtResellerId: "hub-chittagong",
      district: "Chittagong",
      productName: "Oil",
      pendingDemand: 200,
      reservedDemand: 0,
      effectiveDeficit: 200,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.ChittagongHub.lat,
      lng: coords.ChittagongHub.lng,
    },
  ];

  const p3 = planPhase3({
    suppliesAfterPhase2: suppliesP3WithHub,
    hubSurplus: {
      "hub-dhaka": { Rice: 300, Oil: 200 },
    },
    districtDemands,
    intraDistrictFills: {},
    getDistrictCoords: (d) =>
      d === "Dhaka" ? coords.DhakaHub : coords.ChittagongHub,
  });

  assertEq(
    p3.shipments.length,
    1,
    "Phase 3: ONE bundled shipment (rice+oil on same truck)"
  );
  const truck = p3.shipments[0];
  assertEq(truck.lineItems.length, 2, "Truck carries 2 line items");
  const truckProducts = truck.lineItems.map((li) => li.productName).sort();
  assert(
    truckProducts[0] === "Oil" && truckProducts[1] === "Rice",
    "Truck has both Rice and Oil bundled"
  );
  assertEq(
    truck.lineItems.find((li) => li.productName === "Rice")?.allocatedQty,
    300,
    "Bundled rice qty = 300"
  );
  assertEq(
    truck.lineItems.find((li) => li.productName === "Oil")?.allocatedQty,
    200,
    "Bundled oil qty = 200"
  );
  assertEq(
    truck.fromId,
    "hub-dhaka",
    "Truck source = hub-dhaka"
  );
  assertEq(
    truck.toId,
    "hub-chittagong",
    "Truck dest = hub-chittagong"
  );
  assertEq(truck.phase, 3, "Phase 3 shipment");
  assert(!!truck.expiresAt, "Phase 3 truck has approval expiry");
}

// ============================================================
// EDGE CASE 7 — Seller has 10 products, only 3 have local demand
// ============================================================
async function edgeCase7() {
  header("EDGE CASE 7 — 10 products, selective demand — no over-shipment");

  // Seller A has 10 products; only 3 have demand in Mirpur.
  // Products with zero demand should NOT be included in any
  // shipment, because Phase 1 only routes to a destination
  // that has effectiveDeficit > 0.
  const products = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
  const supplies: ProductSupply[] = products.map((p) => ({
    productName: p,
    productCode: `${p}01`,
    sellerProductId: `sp-${p}`,
    sellerId: "seller-A",
    district: "Dhaka",
    upazilla: "Mirpur",
    available: 100,
  }));

  // Only P1, P3, P7 have demand in Mirpur. No demand elsewhere
  // for P4, P6, P8, P10.
  const demandedInMirpur = ["P1", "P3", "P7"];
  const upazillaDemands: UpazillaDemandEntry[] = demandedInMirpur.map(
    (p) => ({
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: p,
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    })
  );

  const suppliesWithOwner = supplies.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) => coords.Mirpur,
  });

  // Phase 1 should only ship the 3 products with demand
  const shippedProducts = p1.shipments
    .flatMap((s) => s.lineItems)
    .map((li) => li.productName)
    .sort();
  assertEq(p1.shipments.length, 3, "Phase 1: 3 shipments (one per demanded product)");
  assertEq(shippedProducts.length, 3, "Total 3 line items emitted");
  for (const p of demandedInMirpur) {
    assert(
      shippedProducts.includes(p),
      `${p} shipped (it has demand)`
    );
  }
  for (const p of products) {
    if (!demandedInMirpur.includes(p)) {
      assert(
        !shippedProducts.includes(p),
        `${p} NOT shipped (no demand anywhere)`
      );
    }
  }

  // No empty shipments
  for (const ship of p1.shipments) {
    assert(ship.lineItems.length > 0, `Shipment has > 0 line items`);
    assert(ship.totalQuantity > 0, `Shipment totalQuantity > 0`);
  }

  // Unused products: P2, P4, P5, P6, P8, P9, P10 should remain
  // at seller (available for Phase 2/3) but not be in Phase 1
  // shipments.
  const unused = products.filter((p) => !demandedInMirpur.includes(p));
  for (const p of unused) {
    const inShip = p1.shipments
      .flatMap((s) => s.lineItems)
      .some((li) => li.productName === p);
    assert(!inShip, `${p} not in any Phase 1 shipment`);
  }
}

// ============================================================
// EDGE CASE 8 — Single product, demand in 3 upazillas,
// 3 separate trucks
// ============================================================
async function edgeCase8() {
  header("EDGE CASE 8 — Same product, 3 destinations, 3 trucks");

  // Seller A has Rice 500; Mirpur wants 200, Dhanmondi 150, Uttara 100.
  // Phase 1: each (seller, own upazilla) pair is one supply row.
  // The engine's R2 says we can only route a product from a
  // seller to a *single* Phase 1 destination (the own upazilla),
  // capped at MAX_PHASE1_DESTINATIONS_PER_PRODUCT=1. So Rice
  // from Mirpur-seller only fills Mirpur. The other 2 upazillas
  // are served by the *district hub* in Phase 2.
  //
  // This test exercises the equivalent flow: each seller-upazilla
  // is its own supply, producing its own shipment, with the
  // remainder going to the hub for Phase 2.

  // Approach: model the seller as having Rice in their own
  // upazilla (Mirpur), with the other 2 upazillas served by
  // a district hub in Phase 2.
  const supplies: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 500,
    },
  ];
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 200,
      reservedDemand: 0,
      effectiveDeficit: 200,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-dhanmondi",
      upazilla: "Dhanmondi",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 150,
      reservedDemand: 0,
      effectiveDeficit: 150,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Dhanmondi.lat,
      lng: coords.Dhanmondi.lng,
    },
    {
      upazillaResellerId: "upz-uttara",
      upazilla: "Uttara",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat + 0.05,
      lng: coords.Mirpur.lng - 0.05,
    },
  ];

  const suppliesWithOwner = supplies.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) => coords[u] ?? coords.Mirpur,
  });

  // Phase 1: 1 truck to Mirpur with 200 rice
  assertEq(p1.shipments.length, 1, "Phase 1: 1 truck to Mirpur");
  assertEq(p1.shipments[0].toId, "upz-mirpur", "Phase 1 truck → Mirpur");
  assertEq(
    p1.shipments[0].lineItems[0].allocatedQty,
    200,
    "Phase 1 fills Mirpur 200"
  );

  // Phase 2: hub serves the other 2 upazillas
  // Build suppliesAfterPhase1 = 300 rice remaining at hub-dhaka
  const phase1DestDelta = {
    "upz-mirpur": { Rice: 200 },
  };
  const p2 = planPhase2({
    suppliesAfterPhase1: [
      {
        productName: "Rice",
        productCode: "RICE01",
        sellerProductId: "sp-rice",
        sellerId: "seller-A",
        district: "Dhaka",
        upazilla: "Mirpur",
        available: 300, // 500 - 200 Phase 1
        hubDistrictResellerId: "hub-dhaka",
        ownUpazillaResellerId: "upz-mirpur",
      } as any,
    ],
    upazillaDemands,
    phase1DestinationDelta: phase1DestDelta,
    getUpazillaCoords: (u) => coords[u] ?? coords.Mirpur,
    getDistrictCoords: (d) => coords.DhakaHub,
  });

  // Phase 2: 2 trucks (one per remaining upazilla)
  assertEq(p2.shipments.length, 2, "Phase 2: 2 trucks (Dhanmondi + Uttara)");

  const dhanmondiTruck = p2.shipments.find(
    (s) => s.toId === "upz-dhanmondi"
  );
  const uttaraTruck = p2.shipments.find((s) => s.toId === "upz-uttara");
  assert(!!dhanmondiTruck, "Dhanmondi truck exists");
  assert(!!uttaraTruck, "Uttara truck exists");
  assertEq(
    dhanmondiTruck?.lineItems[0]?.allocatedQty,
    150,
    "Dhanmondi gets 150 rice"
  );
  assertEq(
    uttaraTruck?.lineItems[0]?.allocatedQty,
    100,
    "Uttara gets 100 rice"
  );

  // Each truck has its own distanceKm (per-truck, not shared)
  assert(
    dhanmondiTruck!.distanceKm > 0,
    "Dhanmondi truck has positive distance"
  );
  assert(
    uttaraTruck!.distanceKm > 0,
    "Uttara truck has positive distance"
  );

  // Total conservation: 200 + 150 + 100 = 450. Surplus 50.
  const totalRouted =
    (p1.shipments[0].lineItems[0].allocatedQty ?? 0) +
    (dhanmondiTruck?.lineItems[0]?.allocatedQty ?? 0) +
    (uttaraTruck?.lineItems[0]?.allocatedQty ?? 0);
  assertEq(totalRouted, 450, "Total rice routed = 450 (3 trucks)");
  assertEq(
    p2.unallocated.Rice ?? 0,
    50,
    "Phase 2 unallocated rice = 50 (surplus)"
  );
}

// ============================================================
// EDGE CASE 9 — Two products, same seller/upazilla,
// one has insufficient stock
// ============================================================
async function edgeCase9() {
  header("EDGE CASE 9 — Partial fill of Oil in same truck as Rice");

  // Seller A in Mirpur: Rice 300 (demand 200), Oil 50 (demand 100).
  // The engine processes each (supply, product) independently in
  // Phase 1, so we get 2 shipments: one full Rice (200/200),
  // one partial Oil (50/100). The Oil shipment's allocatedQty
  // is 50 even though the demand was 100, and the unallocated
  // map records the 50 unmet demand.
  const supplies: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 300,
    },
    {
      productName: "Oil",
      productCode: "OIL01",
      sellerProductId: "sp-oil",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 50, // < demand of 100
    },
  ];
  const upazillaDemands: UpazillaDemandEntry[] = [
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Rice",
      pendingDemand: 200,
      reservedDemand: 0,
      effectiveDeficit: 200,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
    {
      upazillaResellerId: "upz-mirpur",
      upazilla: "Mirpur",
      district: "Dhaka",
      productName: "Oil",
      pendingDemand: 100,
      reservedDemand: 0,
      effectiveDeficit: 100,
      waitingDays: 1,
      pheromoneScore: 0.5,
      lat: coords.Mirpur.lat,
      lng: coords.Mirpur.lng,
    },
  ];

  const suppliesWithOwner = supplies.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));

  const p1 = planPhase1({
    supplies: suppliesWithOwner,
    upazillaDemands,
    getUpazillaCoords: (u) => coords.Mirpur,
  });

  // Two shipments: one for Rice, one for Oil
  assertEq(p1.shipments.length, 2, "Two shipments (rice + oil)");
  const riceShip = p1.shipments.find(
    (s) => s.lineItems[0]?.productName === "Rice"
  );
  const oilShip = p1.shipments.find(
    (s) => s.lineItems[0]?.productName === "Oil"
  );
  assert(!!riceShip, "Rice shipment exists");
  assert(!!oilShip, "Oil shipment exists");

  // Rice is full fill
  assertEq(
    riceShip?.lineItems[0]?.allocatedQty,
    200,
    "Rice fully filled (200/200)"
  );
  assertEq(
    riceShip?.lineItems[0]?.demandAtTime,
    200,
    "Rice demand was 200"
  );

  // Oil is partial fill
  assertEq(
    oilShip?.lineItems[0]?.allocatedQty,
    50,
    "Oil partial fill (50/100, capped by available stock)"
  );
  assertEq(
    oilShip?.lineItems[0]?.demandAtTime,
    100,
    "Oil demandAtTime = 100 (still showing original demand)"
  );

  // Conservation: Rice 200 + Oil 50 = 250 allocated.
  // Phase 1 places the surplus in `summary[product].remainingSupply`,
  // NOT in `unallocated` (unallocated is only populated in Phase 2/3/4).
  // (300 rice - 200 = 100 surplus rice at seller; 50 oil - 50 = 0 surplus oil)
  assertEq(
    p1.summary.Rice?.remainingSupply,
    100,
    "Phase 1 summary: Rice remainingSupply = 100 (surplus)"
  );
  assertEq(
    p1.summary.Oil?.remainingSupply,
    0,
    "Phase 1 summary: Oil remainingSupply = 0 (all 50 used)"
  );
  assertEq(
    p1.summary.Rice?.phase1Filled,
    200,
    "Phase 1 summary: Rice phase1Filled = 200"
  );
  assertEq(
    p1.summary.Oil?.phase1Filled,
    50,
    "Phase 1 summary: Oil phase1Filled = 50"
  );
  // The unallocated map should NOT be touched by Phase 1 — engine design.
  assert(
    !p1.unallocated.Oil,
    "Phase 1: Oil unallocated is absent (used all 50 of available 50)"
  );
  assert(
    !p1.unallocated.Rice,
    "Phase 1: Rice unallocated is absent (surplus flows to Phase 2, not unallocated)"
  );

  // Verify both shipments share source-destination pair
  assertEq(riceShip?.fromId, "seller-A", "Rice from seller-A");
  assertEq(oilShip?.fromId, "seller-A", "Oil from seller-A");
  assertEq(riceShip?.toId, "upz-mirpur", "Rice to Mirpur");
  assertEq(oilShip?.toId, "upz-mirpur", "Oil to Mirpur");
}

// ============================================================
// EDGE CASE 10 — Zero-item shipment prevention
// ============================================================
async function edgeCase10() {
  header("EDGE CASE 10 — Zero-item / zero-qty shipment prevention");

  // Test 1: buildShipmentPlans with empty lineItems — should it
  // produce a ShipmentPlan? Per the source (line 315-346) the
  // function does NOT short-circuit on empty input; it returns
  // a plan with totalQuantity=0 and lineItems=[].
  const emptyPlan = buildShipmentPlans({
    phase: 1,
    fromType: "seller",
    fromId: "seller-x",
    fromName: "Seller X",
    toType: "upazilla",
    toId: "upz-y",
    toName: "Upazilla Y",
    distanceKm: 0,
    lineItems: [],
  });
  // We document the engine's current behaviour: empty line items
  // are passed through, but filtered to []. The caller (route
  // handler) MUST skip persisting if items.length === 0.
  assertEq(emptyPlan.lineItems.length, 0, "Empty input → empty lineItems");
  assertEq(emptyPlan.totalQuantity, 0, "Empty input → totalQuantity 0");
  console.log(
    "  ℹ buildShipmentPlans does NOT short-circuit on empty; caller must filter"
  );

  // Test 2: buildShipmentPlans with all zero-qty line items.
  // The filter on line 330 (`allocatedQty > 0`) drops them.
  const zeroQtyPlan = buildShipmentPlans({
    phase: 1,
    fromType: "seller",
    fromId: "seller-x",
    fromName: "Seller X",
    toType: "upazilla",
    toId: "upz-y",
    toName: "Upazilla Y",
    distanceKm: 0,
    lineItems: [
      {
        productName: "Rice",
        allocatedQty: 0,
        acoScore: 0.5,
        distanceKm: 0,
        demandAtTime: 0,
        pheromoneScore: 0.5,
        allocationReason: "local_demand",
      },
      {
        productName: "Oil",
        allocatedQty: 0,
        acoScore: 0.5,
        distanceKm: 0,
        demandAtTime: 0,
        pheromoneScore: 0.5,
        allocationReason: "local_demand",
      },
    ],
  });
  assertEq(
    zeroQtyPlan.lineItems.length,
    0,
    "All zero-qty line items filtered out"
  );
  assertEq(zeroQtyPlan.totalQuantity, 0, "totalQuantity = 0 after filter");

  // Test 3: planPhase1 with no demand anywhere — should produce
  // NO shipments, not zero-item shipments.
  const suppliesNoDemand: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 100,
    },
  ];
  const suppliesNoDemandWithOwner = suppliesNoDemand.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));
  const p1NoDemand = planPhase1({
    supplies: suppliesNoDemandWithOwner,
    upazillaDemands: [], // no demand anywhere
    getUpazillaCoords: (u) => coords.Mirpur,
  });
  assertEq(
    p1NoDemand.shipments.length,
    0,
    "Phase 1 with no demand: 0 shipments"
  );
  assertEq(
    p1NoDemand.shipments.filter((s) => s.lineItems.length === 0).length,
    0,
    "No zero-item shipments emitted"
  );
  assert(
    !("Rice" in p1NoDemand.unallocated) ||
      (p1NoDemand.unallocated.Rice ?? 0) === 0,
    "No demand = no unallocated entry"
  );

  // Test 4: planPhase1 with demand that exceeds all available stock
  // but each (supply, product) has available > 0 — make sure we
  // don't end up with 0-qty items.
  const suppliesPartial: ProductSupply[] = [
    {
      productName: "Rice",
      productCode: "RICE01",
      sellerProductId: "sp-rice",
      sellerId: "seller-A",
      district: "Dhaka",
      upazilla: "Mirpur",
      available: 1, // only 1 unit
    },
  ];
  const suppliesPartialWithOwner = suppliesPartial.map((s) => ({
    ...s,
    ownUpazillaResellerId: "upz-mirpur",
  }));
  const p1Partial = planPhase1({
    supplies: suppliesPartialWithOwner,
    upazillaDemands: [
      {
        upazillaResellerId: "upz-mirpur",
        upazilla: "Mirpur",
        district: "Dhaka",
        productName: "Rice",
        pendingDemand: 1000,
        reservedDemand: 0,
        effectiveDeficit: 1000,
        waitingDays: 1,
        pheromoneScore: 0.5,
        lat: coords.Mirpur.lat,
        lng: coords.Mirpur.lng,
      },
    ],
    getUpazillaCoords: (u) => coords.Mirpur,
  });
  assertEq(p1Partial.shipments.length, 1, "Partial fill: 1 shipment");
  assertEq(
    p1Partial.shipments[0].lineItems[0].allocatedQty,
    1,
    "Allocated = min(1, 1000) = 1"
  );
  assert(
    p1Partial.shipments[0].totalQuantity > 0,
    "Shipment totalQuantity > 0"
  );
}

// ============================================================
// Run all
// ============================================================
async function main() {
  console.log("Multi-Product ACO — Edge Case Suite");
  console.log("===================================");
  await edgeCase1();
  await edgeCase2();
  await edgeCase3();
  await edgeCase4();
  await edgeCase5();
  await edgeCase6();
  await edgeCase7();
  await edgeCase8();
  await edgeCase9();
  await edgeCase10();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("All edge cases passed ✓");
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
