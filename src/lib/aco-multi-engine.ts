// @ts-nocheck
/**
 * Multi-Product Global ACO Engine
 * =================================
 * Pure planning functions for the multi-product bundled-shipment
 * routing system. No DB calls — every function takes plain inputs
 * and returns plain outputs. Persistence happens in the route
 * handlers under /api/aco/global-trigger, /api/aco/phase4-trigger,
 * and /api/aco/shipments/[id]/approve.
 *
 * Truck metaphor
 * --------------
 * Each ACOShipment represents one physical truck. A truck can
 * carry multiple products in a single run (bundling). The
 * engine plans which (destination, product, qty) tuples to
 * bundle onto the same truck, maximizing ACO score per
 * destination.
 *
 * Phases
 * ------
 * Phase 1 — Seller → Upazilla (own district only).
 *           The seller's own upazilla is filled first for
 *           every product in scope, before any product moves
 *           across the chain.
 * Phase 2 — DistrictHub → Upazilla (own district only).
 *           For each product with surplus after Phase 1, send
 *           to other upazillas in the same district.
 * Phase 3 — District → District (inter-district).
 *           For each product with surplus after Phase 2,
 *           propose bundled shipments to other districts.
 *           Requires both source + target district approval.
 * Phase 4 — DestDistrictHub → DestUpazilla.
 *           Once a Phase 3 shipment is approved, the dest
 *           district's hub distributes to its upazillas.
 *
 * Non-negotiable rules
 * --------------------
 *  R1. Demand prerequisite: a product with zero pending
 *      effective deficit at all destinations is dropped from
 *      scope entirely (no point routing stock no one wants).
 *  R2. Own District First: Phase 1 + 2 must be fully exhausted
 *      before any Phase 3 inter-district opportunity is
 *      created. We never skip a phase.
 *  R3. Bottom-up then Top-down: Phase 1 + 2 fill demand bottom-
 *      up (seller → upazilla). Phase 3 + 4 then top-down
 *      (district → district → upazilla).
 *  R4. Parallel product routing: each product is routed
 *      independently through every phase. There is no implicit
 *      ordering of products within a phase.
 *  R5. Stock conservation: every unit of `stockAtSnapshot`
 *      must be either (a) routed into a shipment with
 *      `status != cancelled/rejected`, or (b) left as
 *      unallocated surplus. The sum must balance.
 *  R6. Single + global coexist: this engine never touches
 *      ACORoutingJob or ACOAllocation rows. The single-product
 *      system keeps working in parallel.
 */

import {
  haversineKm,
  calculateACOScore,
  ACO_CONSTANTS,
} from "@/lib/aco-engine";

export const MULTI_ACO_CONSTANTS = {
  // Max products to consider in a single global run. The UI
  // warns the user if their scope exceeds this.
  MAX_PRODUCT_SCOPE: 25,
  // Inter-district approval window, in hours.
  INTER_DISTRICT_EXPIRY_HOURS: 48,
  // Phase 1 is greedy: we cap the number of upazilla
  // destinations per product to keep plan cost bounded.
  MAX_PHASE1_DESTINATIONS_PER_PRODUCT: 1,
  // Phase 2 (intra-district) — at most this many upazillas
  // per product.
  MAX_PHASE2_DESTINATIONS_PER_PRODUCT: 10,
  // Phase 3 (inter-district) — at most this many districts
  // per product.
  MAX_PHASE3_DESTINATIONS_PER_PRODUCT: 5,
  // Minimum qty to bother planning for. Smaller = noise.
  MIN_PLAN_QTY: 1,
};

// =========================================================
// INPUT TYPES (plain JSON-serializable, no Prisma types)
// =========================================================

export interface ProductSupply {
  productName: string;
  productCode?: string;
  sellerProductId?: string;
  sellerId: string;
  district: string;
  upazilla: string;
  // Effective available stock at snapshot time. Should
  // already account for existing pending outbound transfers.
  available: number;
  lat?: number;
  lng?: number;
}

export interface UpazillaDemandEntry {
  upazillaResellerId: string;
  upazilla: string;
  district: string;
  productName: string;
  pendingDemand: number;
  // demandQuantity - fulfilledQuantity
  reservedDemand: number;
  // pending inbound transfer coverage
  effectiveDeficit: number;
  // pendingDemand - reservedDemand, never negative
  waitingDays: number;
  pheromoneScore: number;
  lat: number;
  lng: number;
}

export interface DistrictDemandEntry {
  districtResellerId: string;
  district: string;
  productName: string;
  pendingDemand: number;
  reservedDemand: number;
  effectiveDeficit: number;
  waitingDays: number;
  pheromoneScore: number;
  lat: number;
  lng: number;
}

export interface LocalDemandEntry {
  localResellerId: string;
  resellerCode: string;
  city: string;
  upazilla: string;
  productName: string;
  productCode?: string;
  pendingDemand: number;
  reservedDemand: number;
  effectiveDeficit: number;
  waitingDays: number;
  pheromoneScore: number;
  lat: number;
  lng: number;
}

export interface PlanLineItem {
  productName: string;
  productCode?: string;
  sellerProductId?: string;
  allocatedQty: number;
  acoScore: number;
  distanceKm: number;
  demandAtTime: number;
  pheromoneScore: number;
  allocationReason:
    | "local_demand"
    | "intra_district_aco"
    | "inter_district_aco"
    | "surplus_reserve"
    | "dest_upazilla_routing";
}

export interface ShipmentPlan {
  phase: 1 | 2 | 3 | 4 | 5;
  fromType: "seller" | "district_hub" | "district" | "upazilla_hub";
  fromId: string;
  fromName: string;
  toType: "upazilla" | "district_hub" | "upazilla_reseller" | "local_reseller";
  toId: string;
  toName: string;
  distanceKm: number;
  // average score across line items, weighted by qty
  overallAcoScore: number;
  // sum of all line item qty
  totalQuantity: number;
  // all products carried on this truck
  lineItems: PlanLineItem[];
  // for phase 3 only: approval window
  expiresAt?: string;
}

export interface NegotiationPlan {
  sellerId: string;
  sellerProductId: string;
  productCode: string;
  productName: string;
  requestedQty: number;
  systemPrice: number;
}

export interface PhaseResult {
  shipments: ShipmentPlan[];
  negotiations?: NegotiationPlan[];
  // For accounting, the per-product amount that left
  // a given origin. Used by the route handler to decrement
  // SellerProduct.stock or DistrictStockItem.quantity.
  perProductOriginDelta: Record<
    string, // originId (sellerId or districtId)
    Record<string, number> // productName -> qty
  >;
  perProductDestinationDelta: Record<
    string, // destinationId
    Record<string, number> // productName -> qty
  >;
  // what we could not place
  unallocated: Record<string, number>;
  // debugging summary: { productName: { allocated, demand, score } }
  summary: Record<string, any>;
}

export interface GlobalPlanResult {
  productScope: string[];
  totalSupply: Record<string, number>;
  totalDemand: Record<string, number>;
  phase1: PhaseResult;
  phase2: PhaseResult;
  phase3: PhaseResult;
  phase4: PhaseResult;
  phase5: PhaseResult;
  // Top-level summary, the route handler persists this
  // directly into ACOGlobalJob.{phase1..5}Summary.
  phaseSummaries: {
    phase1: Record<string, any>;
    phase2: Record<string, any>;
    phase3: Record<string, any>;
    phase4: Record<string, any>;
    phase5: Record<string, any>;
  };
}

// =========================================================
// SCORE FUNCTIONS
// =========================================================

/**
 * Multi-product variant of calculateACOScore. The single-
 * product formula is reused, but we expose a clean wrapper
 * so callers don't have to import from aco-engine directly.
 */
export function calculateMultiProductACOScore(params: {
  demandDeficit: number;
  distanceKm: number;
  pheromoneScore: number;
  waitingDays: number;
}): number {
  return calculateACOScore({
    demandDeficit: params.demandDeficit,
    distanceKm: params.distanceKm,
    pheromoneScore: params.pheromoneScore,
    waitingDays: params.waitingDays,
  });
}

// =========================================================
// HELPERS
// =========================================================

/** Look up seller coords with fallback to upazilla centroid. */
function getOriginCoords(
  supply: ProductSupply,
  upazillaLookup: (u: string) => { lat: number; lng: number }
): { lat: number; lng: number } {
  if (typeof supply.lat === "number" && typeof supply.lng === "number") {
    return { lat: supply.lat, lng: supply.lng };
  }
  return upazillaLookup(supply.upazilla);
}

/** Subtract one map from another in place; never goes negative. */
function subtractMap(
  target: Record<string, number>,
  delta: Record<string, number>
): void {
  for (const k of Object.keys(delta)) {
    target[k] = (target[k] ?? 0) - (delta[k] ?? 0);
    if (target[k] < 0) target[k] = 0;
  }
}

/** Sum two maps key by key. */
function addMap(
  target: Record<string, number>,
  delta: Record<string, number>
): void {
  for (const k of Object.keys(delta)) {
    target[k] = (target[k] ?? 0) + (delta[k] ?? 0);
  }
}

/** Take a slice of a map by allowed keys. */
function pickMap(
  src: Record<string, number>,
  keys: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) {
    if (k in src) out[k] = src[k];
  }
  return out;
}

/** Reduce an array of {productName, quantity} into a map. */
function aggregateQuantities(
  items: Array<{ productName: string; quantity: number }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    out[it.productName] = (out[it.productName] ?? 0) + it.quantity;
  }
  return out;
}

// =========================================================
// BUILD SHIPMENT PLANS (the bundling primitive)
// =========================================================

/**
 * Bundle multiple (product, qty) tuples for a single
 * destination into one ShipmentPlan. This is the truck.
 *
 * Use this helper at the end of every phase to convert a
 * flat list of product-level allocations into one shipment
 * record per (origin, destination) pair.
 *
 * Returns a ShipmentPlan with all line items combined, an
 * overallAcoScore that is the qty-weighted mean of the
 * line item scores, and totalQuantity summed.
 */
export function buildShipmentPlans(params: {
  phase: 1 | 2 | 3 | 4 | 5;
  fromType: "seller" | "district_hub" | "district" | "upazilla_hub";
  fromId: string;
  fromName: string;
  toType: "upazilla" | "district_hub" | "upazilla_reseller" | "local_reseller";
  toId: string;
  toName: string;
  distanceKm: number;
  lineItems: PlanLineItem[];
  // for phase 3 only — stringified Date
  expiresAt?: string;
}): ShipmentPlan | null {
  // Drop zero-qty line items. The caller may pass these
  // through by accident when capping at deficit.
  const filtered = params.lineItems.filter((li) => li.allocatedQty > 0);

  if (filtered.length === 0) return null;

  const totalQuantity = filtered.reduce(
    (s, li) => s + li.allocatedQty,
    0
  );
  let overallAcoScore = 0;
  if (totalQuantity > 0) {
    const num = filtered.reduce(
      (s, li) => s + li.acoScore * li.allocatedQty,
      0
    );
    overallAcoScore = num / totalQuantity;
  }

  return {
    phase: params.phase,
    fromType: params.fromType,
    fromId: params.fromId,
    fromName: params.fromName,
    toType: params.toType,
    toId: params.toId,
    toName: params.toName,
    distanceKm: params.distanceKm,
    overallAcoScore,
    totalQuantity,
    lineItems: filtered,
    expiresAt: params.expiresAt,
  };
}

// =========================================================
// PHASE 1: SELLER -> OWN UPAZILLA
// =========================================================

/**
 * Phase 1: For each product in scope, route from each
 * seller's own upazilla (same upazilla) to satisfy
 * local upazilla demand. This is the cheapest, fastest
 * leg of the chain. If the seller's own upazilla has no
 * demand for the product, the product is *not* dropped
 * — it can still flow to other upazillas in Phase 2.
 *
 * Inputs are pre-resolved: the caller (the route handler)
 * supplies one entry per (seller, product) with available
 * stock, and one demand entry per (upazilla, product) with
 * pending demand. We do not query the DB here.
 *
 * Output: bundled shipments (one per seller→upazilla pair)
 * plus a delta map for inventory bookkeeping.
 */
export function planPhase1(params: {
  supplies: ProductSupply[];
  upazillaDemands: UpazillaDemandEntry[];
  // Coords lookup, in case a seller lat/lng is missing.
  getUpazillaCoords: (u: string) => { lat: number; lng: number };
}): PhaseResult {
  const negotiations: NegotiationPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  const demandByUpazilla: Record<string, UpazillaDemandEntry[]> = {};
  for (const d of params.upazillaDemands) {
    if (!demandByUpazilla[d.upazillaResellerId]) {
      demandByUpazilla[d.upazillaResellerId] = [];
    }
    demandByUpazilla[d.upazillaResellerId].push(d);
  }

  const truckBuilder: Record<
    string,
    {
      sellerId: string;
      sellerName: string;
      upazillaId: string;
      upazillaName: string;
      distanceKm: number;
      lineItems: PlanLineItem[];
    }
  > = {};

  // Per-supply (seller, product), we have a fixed available
  // qty. Phase 1 only fills the seller's own upazilla; if
  // the demand there is less than available, the rest is
  // surplus and flows to Phase 2.
  for (const supply of params.supplies) {
    const ownDemandList = demandByUpazilla[supply.upazillaResellerIdMatch] ?? [];
    // The above is wrong — we look up demand by upazilla NAME
    // because supply only carries upazilla name. The route
    // handler must pre-join supply.upazilla -> upazillaResellerId
    // by passing supplies with the upazillaResellerId embedded.
    // The convention we use: supply includes `ownUpazillaResellerId`
    // optionally. If absent, we skip Phase 1 for that supply.
    if (!(supply as any).ownUpazillaResellerId) continue;
    const ownUpazillaId = (supply as any).ownUpazillaResellerId as string;
    const ownDemandList2 = demandByUpazilla[ownUpazillaId] ?? [];
    // Defensive: filter to entries matching this product.
    const ownProductDemands = ownDemandList2.filter(
      (d) =>
        d.productName.toLowerCase() === supply.productName.toLowerCase() &&
        d.district.toLowerCase() === supply.district.toLowerCase()
    );
    // Total effective deficit for this product in own upazilla.
    const ownDeficit = ownProductDemands.reduce(
      (s, d) => s + d.effectiveDeficit,
      0
    );

    if (ownDeficit <= 0) {
      // No own-upazilla demand for this product; surplus
      // flows to Phase 2 untouched.
      continue;
    }

    const fill = Math.min(supply.available, ownDeficit);
    if (fill <= 0) continue;

    const originCoords = getOriginCoords(supply, params.getUpazillaCoords);
    const destCoords =
      ownProductDemands[0]?.lat != null && ownProductDemands[0]?.lng != null
        ? { lat: ownProductDemands[0].lat, lng: ownProductDemands[0].lng }
        : params.getUpazillaCoords(supply.upazilla);
    const distanceKm = haversineKm(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng
    );
    const acoScore = calculateMultiProductACOScore({
      demandDeficit: ownDeficit,
      distanceKm,
      pheromoneScore:
        ownProductDemands[0]?.pheromoneScore ?? 1.0,
      waitingDays: ownProductDemands[0]?.waitingDays ?? 0,
    });

    const systemPrice = (supply as any).price ? (supply as any).price * 0.9 : 0;
    
    negotiations.push({
      sellerId: supply.sellerId,
      sellerProductId: supply.sellerProductId,
      productCode: supply.productCode,
      productName: supply.productName,
      requestedQty: fill,
      systemPrice: systemPrice,
    });

    perProductOriginDelta[supply.sellerId] ??= {};
    perProductOriginDelta[supply.sellerId][supply.productName] =
      (perProductOriginDelta[supply.sellerId][supply.productName] ?? 0) + fill;
    perProductDestinationDelta[ownUpazillaId] ??= {};
    perProductDestinationDelta[ownUpazillaId][supply.productName] =
      (perProductDestinationDelta[ownUpazillaId][supply.productName] ?? 0) +
      fill;

    summary[supply.productName] = {
      ownUpazilla: supply.upazilla,
      phase1Filled: fill,
      remainingSupply: supply.available - fill,
    };
  }

  return {
    shipments: [],
    negotiations,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}

// =========================================================
// PHASE 2: DISTRICT HUB -> UPAZILLA (INTRA-DISTRICT)
// =========================================================

/**
 * Phase 2: For each product with surplus after Phase 1,
 * route from the seller's district hub to other upazillas
 * in the same district that have pending demand.
 *
 * Pre-conditions enforced by the caller:
 *   - The seller's surplus is reflected in
 *     `suppliesAfterPhase1[i].available` (i.e. the caller
 *     subtracts Phase 1 fills from the supply before calling).
 *   - The hub's `districtResellerId` is provided per supply.
 *
 * Greedy allocation by ACO score, capped at MAX_PHASE2 per
 * product. Surplus after Phase 2 flows to Phase 3.
 */
export function planPhase2(params: {
  suppliesAfterPhase1: ProductSupply[];
  upazillaDemands: UpazillaDemandEntry[];
  // Optional Phase 1 fills, used to subtract own-upazilla
  // demand that has already been satisfied in Phase 1.
  phase1DestinationDelta: Record<string, Record<string, number>>;
  getUpazillaCoords: (u: string) => { lat: number; lng: number };
  getDistrictCoords: (d: string) => { lat: number; lng: number };
}): PhaseResult {
  const shipments: ShipmentPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  // Index demand by (district, productName) and exclude
  // upazillas already satisfied by Phase 1.
  const demandByKey: Record<
    string,
    Array<UpazillaDemandEntry & { residual: number }>
  > = {};
  for (const d of params.upazillaDemands) {
    if (d.effectiveDeficit <= 0) continue;
    const phase1Fill =
      params.phase1DestinationDelta[d.upazillaResellerId]?.[d.productName] ?? 0;
    const residual = Math.max(0, d.effectiveDeficit - phase1Fill);
    if (residual <= 0) continue;
    const key = `${d.district.toLowerCase()}::${d.productName.toLowerCase()}`;
    if (!demandByKey[key]) demandByKey[key] = [];
    demandByKey[key].push({ ...d, residual });
  }

  // Group supplies by district hub so that a single hub
  // can serve many products in one transaction.
  const suppliesByHub: Record<string, ProductSupply[]> = {};
  for (const s of params.suppliesAfterPhase1) {
    const hubId = (s as any).hubDistrictResellerId as string | undefined;
    if (!hubId) continue;
    if (!suppliesByHub[hubId]) suppliesByHub[hubId] = [];
    suppliesByHub[hubId].push(s);
  }

  const truckBuilder: Record<
    string,
    {
      hubId: string;
      hubDistrict: string;
      destId: string;
      destUpazilla: string;
      distanceKm: number;
      lineItems: PlanLineItem[];
    }
  > = {};

  for (const hubId of Object.keys(suppliesByHub)) {
    const hubSupplies = suppliesByHub[hubId];
    if (hubSupplies.length === 0) continue;
    const hubDistrict = hubSupplies[0].district;
    const hubCoords = params.getDistrictCoords(hubDistrict);

    const suppliesByProduct: Record<string, ProductSupply[]> = {};
    for (const s of hubSupplies) {
      if (s.available <= 0) continue;
      if (!suppliesByProduct[s.productName]) suppliesByProduct[s.productName] = [];
      suppliesByProduct[s.productName].push(s);
    }

    for (const productName of Object.keys(suppliesByProduct)) {
      const productSupplies = suppliesByProduct[productName];
      let totalAvailable = productSupplies.reduce((sum, s) => sum + s.available, 0);
      if (totalAvailable <= 0) continue;

      const key = `${hubDistrict.toLowerCase()}::${productName.toLowerCase()}`;
      
      const candidates = (demandByKey[key] ?? []).filter((d) => {
        // Phase 1 handles own upazilla. If multiple sellers are in different upazillas, 
        // we might still want to exclude them if they were covered, but residual <= 0 handles that.
        // We can explicitly exclude any upazilla that is the origin of ANY of our supplies.
        return !productSupplies.some(s => (s as any).ownUpazillaResellerId === d.upazillaResellerId);
      });

      const scored = candidates.map((d) => {
        const distanceKm = haversineKm(
          hubCoords.lat,
          hubCoords.lng,
          d.lat,
          d.lng
        );
        const acoScore = calculateMultiProductACOScore({
          demandDeficit: d.residual,
          distanceKm,
          pheromoneScore: d.pheromoneScore,
          waitingDays: d.waitingDays,
        });
        return { ...d, distanceKm, acoScore, originalRef: d };
      });

      const valid = scored
        .filter((d) => d.acoScore > 0)
        .sort((a, b) => {
          if (b.acoScore !== a.acoScore) return b.acoScore - a.acoScore;
          return a.upazillaResellerId.localeCompare(b.upazillaResellerId);
        })
        .slice(0, MULTI_ACO_CONSTANTS.MAX_PHASE2_DESTINATIONS_PER_PRODUCT);

      let supplyIdx = 0;

      for (const dest of valid) {
        if (totalAvailable <= 0) break;
        const needed = dest.residual;
        if (needed <= 0) continue;

        let toFill = Math.min(totalAvailable, needed);
        const totalFillForDest = toFill;

        while (toFill > 0 && supplyIdx < productSupplies.length) {
          const currentSupply = productSupplies[supplyIdx];
          if (currentSupply.available <= 0) {
            supplyIdx++;
            continue;
          }

          const chunk = Math.min(toFill, currentSupply.available);
          const lineItem: PlanLineItem = {
            productName: currentSupply.productName,
            productCode: currentSupply.productCode,
            sellerProductId: currentSupply.sellerProductId,
            allocatedQty: chunk,
            acoScore: dest.acoScore,
            distanceKm: dest.distanceKm,
            demandAtTime: dest.residual,
            pheromoneScore: dest.pheromoneScore,
            allocationReason: "intra_district_aco",
          };

          const truckKey = `${hubId}::${dest.upazillaResellerId}`;
          if (!truckBuilder[truckKey]) {
            truckBuilder[truckKey] = {
              hubId,
              hubDistrict,
              destId: dest.upazillaResellerId,
              destUpazilla: dest.upazilla,
              distanceKm: dest.distanceKm,
              lineItems: [],
            };
          }
          truckBuilder[truckKey].lineItems.push(lineItem);

          perProductOriginDelta[currentSupply.sellerId] ??= {};
          perProductOriginDelta[currentSupply.sellerId][currentSupply.productName] =
            (perProductOriginDelta[currentSupply.sellerId][currentSupply.productName] ?? 0) + chunk;

          currentSupply.available -= chunk;
          totalAvailable -= chunk;
          toFill -= chunk;
        }

        dest.originalRef.residual -= totalFillForDest;

        perProductDestinationDelta[dest.upazillaResellerId] ??= {};
        perProductDestinationDelta[dest.upazillaResellerId][productName] =
          (perProductDestinationDelta[dest.upazillaResellerId][productName] ?? 0) + totalFillForDest;
      }

      if (totalAvailable > 0) {
        unallocated[productName] =
          (unallocated[productName] ?? 0) + totalAvailable;
        summary[productName] = {
          ...(summary[productName] ?? {}),
          phase2Surplus: totalAvailable,
        };
      }
    }
  }

  for (const truckKey of Object.keys(truckBuilder)) {
    const t = truckBuilder[truckKey];
    const ship = buildShipmentPlans({
      phase: 2,
      fromType: "district_hub",
      fromId: t.hubId,
      fromName: t.hubDistrict,
      toType: "upazilla",
      toId: t.destId,
      toName: t.destUpazilla,
      distanceKm: t.distanceKm,
      lineItems: t.lineItems,
    });
    if (ship) shipments.push(ship);
  }

  return {
    shipments,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}

// =========================================================
// PHASE 3: DISTRICT -> DISTRICT (INTER-DISTRICT)
// =========================================================

/**
 * Phase 3: For each product with surplus after Phase 2,
 * route from the source district hub to other districts
 * that have pending demand. Each shipment is a *truck*
 * carrying one or more products (bundling).
 *
 * This phase requires both source + target district head
 * approval. The route handler creates shipments in
 * `status: "pending_approval"` and waits.
 *
 * Bundling: at the district level, a single truck can
 * carry multiple products in one go. We group candidate
 * product fills by destination district, then build one
 * shipment per (sourceHub, targetDistrict) pair.
 */
export function planPhase3(params: {
  // After-Phase-2 surplus per (hub, product). The hub id
  // is encoded in the key prefix.
  suppliesAfterPhase2: ProductSupply[];
  // Surplus per (hub, product) at this point
  hubSurplus: Record<string, Record<string, number>>;
  // Demand at the district level, post-Phase 2.
  districtDemands: DistrictDemandEntry[];
  // Phase 1 + 2 fills per (district, product) — we use
  // this to compute residual district-level deficit.
  intraDistrictFills: Record<string, Record<string, number>>;
  getDistrictCoords: (d: string) => { lat: number; lng: number };
}): PhaseResult {
  const shipments: ShipmentPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  // Group demands by (targetDistrictId, productName) to
  // compute residual deficit after intra-district fills.
  // We also need to skip target districts that already have
  // a pending approval-to-us (circular transfer).
  const residualByTarget: Record<
    string,
    Record<string, number> // productName -> residual
  > = {};
  for (const d of params.districtDemands) {
    const fill =
      params.intraDistrictFills[d.district]?.[d.productName] ?? 0;
    const residual = Math.max(0, d.effectiveDeficit - fill);
    if (residual <= 0) continue;
    if (!residualByTarget[d.districtResellerId]) {
      residualByTarget[d.districtResellerId] = {};
    }
    residualByTarget[d.districtResellerId][d.productName] = residual;
  }

  // Index demand by productName -> list of (target, residual)
  // for fast lookup per product.
  const targetByProduct: Record<
    string,
    Array<DistrictDemandEntry & { residual: number }>
  > = {};
  for (const d of params.districtDemands) {
    const fill =
      params.intraDistrictFills[d.district]?.[d.productName] ?? 0;
    const residual = Math.max(0, d.effectiveDeficit - fill);
    if (residual <= 0) continue;
    if (!targetByProduct[d.productName]) targetByProduct[d.productName] = [];
    targetByProduct[d.productName].push({ ...d, residual });
  }

  // For each (sourceHub, product), pick the best target
  // districts and bundle fills onto trucks.
  // Bundling works like this: products going from the same
  // source hub to the same target district in the same
  // Phase 3 plan are consolidated into a single shipment.
  // We accumulate line items into a `truckBuilder` keyed
  // by `${sourceHubId}::${targetDistrictId}`.
  const truckBuilder: Record<
    string, // `${sourceHubId}::${targetDistrictId}`
    {
      sourceHubId: string;
      sourceHubName: string;
      sourceHubCoords: { lat: number; lng: number };
      targetDistrictId: string;
      targetDistrictName: string;
      targetCoords: { lat: number; lng: number };
      lineItems: PlanLineItem[];
    }
  > = {};

  for (const supply of params.suppliesAfterPhase2) {
    const hubId = (supply as any).hubDistrictResellerId as string | undefined;
    if (!hubId) continue;
    if (supply.available <= 0) continue;

    const candidates = (targetByProduct[supply.productName] ?? []).filter(
      (d) => d.districtResellerId !== hubId
    );

    // Score candidates for this product.
    const sourceHubCoords = params.getDistrictCoords(supply.district);
    const scored = candidates.map((d) => {
      const distanceKm = haversineKm(
        sourceHubCoords.lat,
        sourceHubCoords.lng,
        d.lat,
        d.lng
      );
      const acoScore = calculateMultiProductACOScore({
        demandDeficit: d.residual,
        distanceKm,
        pheromoneScore: d.pheromoneScore,
        waitingDays: d.waitingDays,
      });
      return { ...d, distanceKm, acoScore, originalRef: d };
    });

    const valid = scored
      .filter((d) => d.acoScore > 0)
      .sort((a, b) => {
        if (b.acoScore !== a.acoScore) return b.acoScore - a.acoScore;
        return a.districtResellerId.localeCompare(b.districtResellerId);
      })
      .slice(0, MULTI_ACO_CONSTANTS.MAX_PHASE3_DESTINATIONS_PER_PRODUCT);

    let remaining = supply.available;
    for (const dest of valid) {
      if (remaining <= 0) break;
      const fill = Math.min(remaining, dest.residual);
      if (fill <= 0) continue;
      const lineItem: PlanLineItem = {
        productName: supply.productName,
        productCode: supply.productCode,
        sellerProductId: supply.sellerProductId,
        allocatedQty: fill,
        acoScore: dest.acoScore,
        distanceKm: dest.distanceKm,
        demandAtTime: dest.residual,
        pheromoneScore: dest.pheromoneScore,
        allocationReason: "inter_district_aco",
      };
      const truckKey = `${hubId}::${dest.districtResellerId}`;
      if (!truckBuilder[truckKey]) {
        truckBuilder[truckKey] = {
          sourceHubId: hubId,
          sourceHubName: supply.district,
          sourceHubCoords,
          targetDistrictId: dest.districtResellerId,
          targetDistrictName: dest.district,
          targetCoords: { lat: dest.lat, lng: dest.lng },
          lineItems: [],
        };
      }
      truckBuilder[truckKey].lineItems.push(lineItem);
      remaining -= fill;
      dest.originalRef.residual -= fill;
    }

    if (remaining > 0) {
      unallocated[supply.productName] =
        (unallocated[supply.productName] ?? 0) + remaining;
    }
  }

  // Build ShipmentPlan objects from the truckBuilder.
  const expiresAt = new Date();
  expiresAt.setHours(
    expiresAt.getHours() + MULTI_ACO_CONSTANTS.INTER_DISTRICT_EXPIRY_HOURS
  );

  for (const truckKey of Object.keys(truckBuilder)) {
    const t = truckBuilder[truckKey];
    const distanceKm = haversineKm(
      t.sourceHubCoords.lat,
      t.sourceHubCoords.lng,
      t.targetCoords.lat,
      t.targetCoords.lng
    );
    const ship = buildShipmentPlans({
      phase: 3,
      fromType: "district_hub",
      fromId: t.sourceHubId,
      fromName: t.sourceHubName,
      toType: "district_hub",
      toId: t.targetDistrictId,
      toName: t.targetDistrictName,
      distanceKm,
      lineItems: t.lineItems,
      expiresAt: expiresAt.toISOString(),
    });
    if (!ship) continue;
    shipments.push(ship);
    perProductOriginDelta[t.sourceHubId] ??= {};
    perProductDestinationDelta[t.targetDistrictId] ??= {};
    for (const li of ship.lineItems) {
      perProductOriginDelta[t.sourceHubId][li.productName] =
        (perProductOriginDelta[t.sourceHubId][li.productName] ?? 0) +
        li.allocatedQty;
      perProductDestinationDelta[t.targetDistrictId][li.productName] =
        (perProductDestinationDelta[t.targetDistrictId][li.productName] ?? 0) +
        li.allocatedQty;
    }
  }

  return {
    shipments,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}

// =========================================================
// PHASE 4: DEST DISTRICT HUB -> DEST UPAZILLA
// =========================================================

/**
 * Phase 4: Once a Phase 3 inter-district shipment is
 * approved, the destination district's hub distributes the
 * arriving products to its own upazillas that have pending
 * demand. This is the *top-down* half of the chain.
 *
 * Inputs are one shipment's line items. We never re-bundle
 * across shipments in Phase 4 — each approved Phase 3 truck
 * unloads at one dest hub, and Phase 4 distributes from
 * there.
 */
export function planPhase4(params: {
  // The line items that arrived in this Phase 3 truck.
  // Each line has a product and qty. The dest hub
  // now holds these and must allocate to dest upazillas.
  arrivingLineItems: PlanLineItem[];
  arrivingAtDistrict: string; // dest district name
  arrivingAtHubId: string; // dest district reseller id
  // Demand entries at the dest district. The engine
  // filters to entries whose district == arrivingAtDistrict.
  districtDemands: DistrictDemandEntry[];
  upazillaDemands: UpazillaDemandEntry[];
  // What Phase 1 + 2 already filled at this dest district
  // (so we don't double-count). Keyed by
  // `${upazillaResellerId}::${productName}` -> qty.
  intraDistrictFillsByKey: Record<string, number>;
  getUpazillaCoords: (u: string) => { lat: number; lng: number };
}): PhaseResult {
  const shipments: ShipmentPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  const truckBuilder: Record<
    string,
    {
      destId: string;
      destUpazilla: string;
      distanceKm: number;
      lineItems: PlanLineItem[];
    }
  > = {};

  // For each arriving product, find upazilla destinations
  // in the dest district that still have residual demand.
  for (const line of params.arrivingLineItems) {
    if (line.allocatedQty <= 0) continue;
    const destUpazillas = params.upazillaDemands.filter(
      (d) =>
        d.district.toLowerCase() === params.arrivingAtDistrict.toLowerCase() &&
        d.productName.toLowerCase() === line.productName.toLowerCase()
    );
    const residual = destUpazillas
      .map((d) => {
        const key = `${d.upazillaResellerId}::${d.productName}`;
        const filled = params.intraDistrictFillsByKey[key] ?? 0;
        return Math.max(0, d.effectiveDeficit - filled);
      })
      .reduce((a, b) => a + b, 0);

    if (residual <= 0) {
      unallocated[line.productName] =
        (unallocated[line.productName] ?? 0) + line.allocatedQty;
      continue;
    }

    const cap = Math.min(line.allocatedQty, residual);

    // Greedy ACO score for the dest upazillas.
    const scored = destUpazillas
      .map((d) => {
        const key = `${d.upazillaResellerId}::${d.productName}`;
        const filled = params.intraDistrictFillsByKey[key] ?? 0;
        const localResidual = Math.max(0, d.effectiveDeficit - filled);
        const distanceKm = haversineKm(
          (d as any).hubLat ?? d.lat,
          (d as any).hubLng ?? d.lng,
          d.lat,
          d.lng
        );
        const acoScore = calculateMultiProductACOScore({
          demandDeficit: localResidual,
          distanceKm,
          pheromoneScore: d.pheromoneScore,
          waitingDays: d.waitingDays,
        });
        return { ...d, localResidual, distanceKm, acoScore };
      })
      .filter((d) => d.acoScore > 0 && d.localResidual > 0)
      .sort((a, b) => {
        if (b.acoScore !== a.acoScore) return b.acoScore - a.acoScore;
        return a.upazillaResellerId.localeCompare(b.upazillaResellerId);
      });

    let remaining = cap;
    for (const dest of scored) {
      if (remaining <= 0) break;
      const fill = Math.min(remaining, dest.localResidual);
      if (fill <= 0) continue;
      const li: PlanLineItem = {
        productName: line.productName,
        productCode: line.productCode,
        sellerProductId: line.sellerProductId,
        allocatedQty: fill,
        acoScore: dest.acoScore,
        distanceKm: dest.distanceKm,
        demandAtTime: dest.localResidual,
        pheromoneScore: dest.pheromoneScore,
        allocationReason: "dest_upazilla_routing",
      };

      const truckKey = dest.upazillaResellerId;
      if (!truckBuilder[truckKey]) {
        truckBuilder[truckKey] = {
          destId: dest.upazillaResellerId,
          destUpazilla: dest.upazilla,
          distanceKm: dest.distanceKm,
          lineItems: [],
        };
      }
      truckBuilder[truckKey].lineItems.push(li);

      perProductOriginDelta[params.arrivingAtHubId] ??= {};
      perProductOriginDelta[params.arrivingAtHubId][line.productName] =
        (perProductOriginDelta[params.arrivingAtHubId][line.productName] ?? 0) +
        fill;
      perProductDestinationDelta[dest.upazillaResellerId] ??= {};
      perProductDestinationDelta[dest.upazillaResellerId][line.productName] =
        (perProductDestinationDelta[dest.upazillaResellerId][line.productName] ??
          0) +
        fill;
      remaining -= fill;
    }

    if (remaining > 0) {
      unallocated[line.productName] =
        (unallocated[line.productName] ?? 0) + remaining;
    }
    summary[line.productName] = {
      arrived: line.allocatedQty,
      distributed: cap - remaining,
      leftover: remaining,
    };
  }

  for (const truckKey of Object.keys(truckBuilder)) {
    const t = truckBuilder[truckKey];
    const ship = buildShipmentPlans({
      phase: 4,
      fromType: "district",
      fromId: params.arrivingAtHubId,
      fromName: params.arrivingAtDistrict,
      toType: "upazilla",
      toId: t.destId,
      toName: t.destUpazilla,
      distanceKm: t.distanceKm,
      lineItems: t.lineItems,
    });
    if (ship) shipments.push(ship);
  }

  return {
    shipments,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}

// =========================================================
// CONSERVATION VERIFICATION
// =========================================================

export interface ConservationInput {
  // One entry per (seller, product) — what was available
  // at snapshot time.
  supplySnapshots: Array<{
    sellerProductId: string;
    productName: string;
    stockAtSnapshot: number;
  }>;
  // All line items from this job, including all phases.
  // The verifier excludes cancelled/rejected.
  shipmentLineItems: Array<{
    productName: string;
    allocatedQty: number;
    status: string;
  }>;
}

export interface ConservationResult {
  balanced: boolean;
  perProduct: Record<
    string,
    { expected: number; actual: number; discrepancy: number }
  >;
  totalDiscrepancy: number;
  violations: Array<{
    productName: string;
    expected: number;
    actual: number;
    discrepancy: number;
  }>;
  executedTotal: number;
  pendingApproval: number;
  note?: string;
}

/**
 * Conservation check across the entire multi-product
 * pipeline. For every product, sum the supply snapshots
 * (i.e. what the sellers said they had at plan time) and
 * compare to the sum of every line item's allocatedQty
 * (excluding cancelled/rejected). Any discrepancy is a
 * conservation violation that admin must investigate.
 *
 * Note: stock can either be (a) routed, or (b) left as
 * unallocated surplus. The verifier considers both, so
 * the expected is `stockAtSnapshot` and the actual is
 * `sum of allocatedQty` for non-cancelled line items.
 * In a clean run, expected > actual, and the difference
 * equals the unallocated surplus.
 */
export function verifyMultiProductConservation(
  input: ConservationInput
): ConservationResult {
  const expected: Record<string, number> = {};
  for (const s of input.supplySnapshots) {
    expected[s.productName] =
      (expected[s.productName] ?? 0) + s.stockAtSnapshot;
  }

  const actual: Record<string, number> = {};
  let executedTotal = 0;
  let pendingApproval = 0;

  for (const li of input.shipmentLineItems) {
    if (li.status === "cancelled" || li.status === "rejected" || li.status === "expired") continue;
    actual[li.productName] = (actual[li.productName] ?? 0) + li.allocatedQty;

    if (li.status === "pending_approval") {
      pendingApproval += li.allocatedQty;
    } else {
      executedTotal += li.allocatedQty;
    }
  }

  const perProduct: ConservationResult["perProduct"] = {};
  const violations: ConservationResult["violations"] = [];
  let totalDiscrepancy = 0;

  const allProductNames = new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ]);
  for (const productName of allProductNames) {
    const exp = expected[productName] ?? 0;
    const act = actual[productName] ?? 0;
    // Conservation rule: actual must not exceed expected.
    // (act < exp is fine — that's just unallocated surplus.)
    const discrepancy = act - exp;
    perProduct[productName] = {
      expected: exp,
      actual: act,
      discrepancy,
    };
    if (discrepancy > 0) {
      violations.push({
        productName,
        expected: exp,
        actual: act,
        discrepancy,
      });
      totalDiscrepancy += discrepancy;
    }
  }

  let note;
  if (pendingApproval > 0) {
    note = `${pendingApproval} units pending inter-district approval`;
  }

  return {
    balanced: violations.length === 0,
    perProduct,
    totalDiscrepancy,
    violations,
    executedTotal,
    pendingApproval,
    note,
  };
}
export function planPhase5(params: {
  upazillaStocks: ProductSupply[];
  localDemands: LocalDemandEntry[];
  getUpazillaCoords: (u: string) => { lat: number; lng: number };
  getLocalCoords: (l: string) => { lat: number; lng: number };
}): PhaseResult {
  const shipments: ShipmentPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  const demandByKey: Record<
    string,
    Array<LocalDemandEntry & { residual: number }>
  > = {};
  for (const d of params.localDemands) {
    if (d.effectiveDeficit <= 0) continue;
    const key = `${d.upazilla.toLowerCase()}::${d.productName.toLowerCase()}`;
    if (!demandByKey[key]) demandByKey[key] = [];
    demandByKey[key].push({ ...d, residual: d.effectiveDeficit });
  }

  const suppliesByUpazilla: Record<string, ProductSupply[]> = {};
  for (const s of params.upazillaStocks) {
    if (!suppliesByUpazilla[s.sellerId]) suppliesByUpazilla[s.sellerId] = [];
    suppliesByUpazilla[s.sellerId].push(s);
  }

  for (const upazillaId of Object.keys(suppliesByUpazilla)) {
    const hubSupplies = suppliesByUpazilla[upazillaId];
    if (hubSupplies.length === 0) continue;
    const hubUpazillaName = hubSupplies[0].upazilla;
    const hubCoords = params.getUpazillaCoords(hubUpazillaName);

    const suppliesByProduct: Record<string, ProductSupply[]> = {};
    for (const s of hubSupplies) {
      if (s.available <= 0) continue;
      if (!suppliesByProduct[s.productName]) suppliesByProduct[s.productName] = [];
      suppliesByProduct[s.productName].push(s);
    }

    for (const productName of Object.keys(suppliesByProduct)) {
      const productSupplies = suppliesByProduct[productName];
      let totalAvailable = productSupplies.reduce((sum, s) => sum + s.available, 0);
      if (totalAvailable <= 0) continue;

      const key = `${hubUpazillaName.toLowerCase()}::${productName.toLowerCase()}`;
      
      const candidates = demandByKey[key] ?? [];

      const scored = candidates.map((d) => {
        const distanceKm = haversineKm(
          hubCoords.lat,
          hubCoords.lng,
          d.lat,
          d.lng
        );
        const acoScore = calculateMultiProductACOScore({
          demandDeficit: d.residual,
          distanceKm,
          pheromoneScore: d.pheromoneScore,
          waitingDays: d.waitingDays,
        });
        return { ...d, distanceKm, acoScore, originalRef: d };
      });

      const valid = scored
        .filter((d) => d.acoScore > 0)
        .sort((a, b) => b.acoScore - a.acoScore);

      let supplyIdx = 0;
      const truckBuilder: Record<
        string,
        {
          destId: string;
          destName: string;
          distanceKm: number;
          lineItems: PlanLineItem[];
        }
      > = {};

      for (const dest of valid) {
        if (totalAvailable <= 0) break;
        const needed = dest.residual;
        if (needed <= 0) continue;

        let toFill = Math.min(totalAvailable, needed);
        const totalFillForDest = toFill;

        while (toFill > 0 && supplyIdx < productSupplies.length) {
          const currentSupply = productSupplies[supplyIdx];
          if (currentSupply.available <= 0) {
            supplyIdx++;
            continue;
          }

          const chunk = Math.min(toFill, currentSupply.available);
          const lineItem: PlanLineItem = {
            productName: currentSupply.productName,
            productCode: currentSupply.productCode,
            sellerProductId: currentSupply.sellerProductId,
            allocatedQty: chunk,
            acoScore: dest.acoScore,
            distanceKm: dest.distanceKm,
            demandAtTime: dest.residual,
            pheromoneScore: dest.pheromoneScore,
            allocationReason: "local_demand",
          };

          const truckKey = dest.localResellerId;
          if (!truckBuilder[truckKey]) {
            truckBuilder[truckKey] = {
              destId: dest.localResellerId,
              destName: dest.resellerCode,
              distanceKm: dest.distanceKm,
              lineItems: [],
            };
          }
          truckBuilder[truckKey].lineItems.push(lineItem);

          perProductOriginDelta[upazillaId] ??= {};
          perProductOriginDelta[upazillaId][currentSupply.productName] =
            (perProductOriginDelta[upazillaId][currentSupply.productName] ?? 0) + chunk;

          currentSupply.available -= chunk;
          totalAvailable -= chunk;
          toFill -= chunk;
        }

        dest.originalRef.residual -= totalFillForDest;

        perProductDestinationDelta[dest.localResellerId] ??= {};
        perProductDestinationDelta[dest.localResellerId][productName] =
          (perProductDestinationDelta[dest.localResellerId][productName] ?? 0) + totalFillForDest;
      }

      for (const truckKey of Object.keys(truckBuilder)) {
        const t = truckBuilder[truckKey];
        const ship = buildShipmentPlans({
          phase: 5 as any,
          fromType: "district_hub", 
          // Note: using district_hub to represent upazilla hub since "upazilla_hub" isn't a type
          fromId: upazillaId,
          fromName: hubUpazillaName,
          toType: "upazilla_reseller",
          // Note: toType="upazilla_reseller" actually means local reseller? In Phase 1 we use "upazilla" for upazilla hub.
          // Let's use "local_reseller"
          toId: t.destId,
          toName: t.destName,
          distanceKm: t.distanceKm,
          lineItems: t.lineItems,
        });
        if (ship) {
          ship.fromType = "upazilla_hub" as any;
          ship.toType = "local_reseller" as any;
          shipments.push(ship);
        }
      }

      if (totalAvailable > 0) {
        unallocated[productName] =
          (unallocated[productName] ?? 0) + totalAvailable;
        summary[productName] = {
          ...(summary[productName] ?? {}),
          phase5Surplus: totalAvailable,
        };
      }
    }
  }

  return {
    shipments,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}
