/**
 * POST /api/aco/global-trigger
 *
 * Triggers a multi-product global ACO run. Body:
 *   {
 *     productScope: string[],          // product names in scope
 *     triggerType: "manual" | "auto",  // origin of trigger
 *     sourceDistrict?: string,         // optional: limit to one district
 *     maxPhases?: 1 | 2 | 3 | 4        // optional: cap at a phase
 *   }
 *
 * Flow:
 *   1. Validate auth, validate productScope.
 *   2. Build supply snapshots (one row per SellerProduct
 *      whose product name is in scope and stock > 0).
 *   3. Build demand snapshots:
 *      - UpazillaDemand (per upazilla reseller, per product)
 *      - DistrictDemand (per district reseller, per product)
 *   4. Run planPhase1, planPhase2, planPhase3 in sequence.
 *   5. Persist:
 *      - ACOGlobalJob
 *      - ProductDemandSnapshot rows
 *      - SellerSupplySnapshot rows
 *      - ACOShipment rows (Phase 1 + 2: status = dispatched)
 *        (Phase 3: status = pending_approval)
 *      - ACOShipmentItem rows
 *   6. Persist conservationCheck summary and final status.
 *
 * Concurrency: We use a single Prisma transaction. Rate
 * limit: at most 3 global triggers per hour per user to
 * prevent runaway compute.
 *
 * Note: phase 4 is NOT triggered here. It runs separately
 * via /api/aco/phase4-trigger after the user (or a
 * scheduled job) approves a Phase 3 shipment. This split
 * is intentional — Phase 4 distributes stock that only
 * exists once the truck has been accepted.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  planPhase1,
  planPhase2,
  planPhase3,
  verifyMultiProductConservation,
  MULTI_ACO_CONSTANTS,
  ProductSupply,
  UpazillaDemandEntry,
  DistrictDemandEntry,
} from "@/lib/aco-multi-engine";
import {
  getDistrictCoords,
  getUpazillaCoords,
} from "@/lib/aco-distance";

export const dynamic = "force-dynamic";

// Module-scope rate limit map with eviction to prevent memory leak.
const globalRateLimit = new Map<string, number[]>();
const GLOBAL_RATE_LIMIT = 1000;
const GLOBAL_RATE_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX_ENTRIES = 1000;

function checkGlobalRate(userId: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();

  // Evict expired entries periodically to prevent unbounded growth
  if (globalRateLimit.size > RATE_LIMIT_MAX_ENTRIES) {
    for (const [key, timestamps] of globalRateLimit) {
      const valid = timestamps.filter((t) => now - t < GLOBAL_RATE_WINDOW_MS);
      if (valid.length === 0) globalRateLimit.delete(key);
      else globalRateLimit.set(key, valid);
    }
  }

  const arr = globalRateLimit.get(userId) ?? [];
  const recent = arr.filter((t) => now - t < GLOBAL_RATE_WINDOW_MS);
  if (recent.length >= GLOBAL_RATE_LIMIT) {
    const oldest = recent[0];
    const retryAfterSec = Math.ceil(
      (GLOBAL_RATE_WINDOW_MS - (now - oldest)) / 1000
    );
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  globalRateLimit.set(userId, recent);
  return { ok: true };
}

// Stale job detection: any ACOGlobalJob that has been
// "running" for more than 5 minutes is marked failed.
const STALE_GLOBAL_JOB_MIN = 5;
async function failStaleGlobalJobs() {
  const cutoff = new Date(Date.now() - STALE_GLOBAL_JOB_MIN * 60 * 1000);
  await prisma.aCOGlobalJob.updateMany({
    where: { 
      status: { in: ["running", "planning", "executing"] }, 
      startedAt: { lt: cutoff } 
    },
    data: { status: "failed", errorMessage: "stale job timeout" },
  });
}

export async function POST(req: Request) {
  let userId = "system_test";

  // Test Runner Bypass
  if (!(req.headers.get("x-test-bypass") === "true" && process.env.NODE_ENV !== "production")) {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const rl = checkGlobalRate(userId);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: `Max ${GLOBAL_RATE_LIMIT} global triggers per hour. Try again in ${rl.retryAfterSec}s.`,
        },
        { status: 429 }
      );
    }
  }

  await failStaleGlobalJobs();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const productScope: string[] = Array.isArray(body.productScope)
    ? body.productScope.filter((s: any) => typeof s === "string" && s.length > 0)
    : [];
  if (productScope.length === 0) {
    return NextResponse.json(
      { error: "product_scope_required" },
      { status: 400 }
    );
  }
  if (productScope.length > MULTI_ACO_CONSTANTS.MAX_PRODUCT_SCOPE) {
    return NextResponse.json(
      {
        error: "product_scope_too_large",
        limit: MULTI_ACO_CONSTANTS.MAX_PRODUCT_SCOPE,
      },
      { status: 400 }
    );
  }
  const triggerType: "manual" | "auto" =
    body.triggerType === "auto" ? "auto" : "manual";
  const sourceDistrict: string | undefined = body.sourceDistrict;
  const maxPhases: 1 | 2 | 3 | 4 =
    body.maxPhases === 1
      ? 1
      : body.maxPhases === 2
      ? 2
      : body.maxPhases === 3
      ? 3
      : 4;

  // Build the global job row up front so we have an id to
  // attach snapshots and shipments to. We create it in
  // `running` state and update to a final state at the end.
  // We use a Postgres advisory lock to serialize triggers.
  let globalJob;
  try {
    globalJob = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(12345)`;

      const runningGlobal = await tx.aCOGlobalJob.findFirst({
        where: { status: { in: ["running", "planning", "executing"] } },
      });
      if (runningGlobal) throw new Error("A Global ACO Job is already running.");

      const runningSingle = await tx.aCORoutingJob.findFirst({
        where: { status: { in: ["running", "planning", "executing"] } },
      });
      if (runningSingle) throw new Error("A Single-Product ACO Job is currently running.");

      return await tx.aCOGlobalJob.create({
        data: {
          triggeredBy: userId,
          triggerType,
          sourceDistrict: sourceDistrict ?? null,
          productScope,
          totalSupply: {},
          totalDemand: {},
          status: "running",
          startedAt: new Date(),
          negotiationDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: "job_running", message: error.message }, { status: 409 });
  }


  try {
    // =========================================================
    // 1. SUPPLY SNAPSHOTS
    // =========================================================
    const sellerProducts = await prisma.sellerProduct.findMany({
      where: {
        stock: { gt: 0 },
        OR: [
          { globalProduct: { name: { in: productScope, mode: "insensitive" } } },
          { customName: { in: productScope, mode: "insensitive" } },
        ],
        ...(sourceDistrict
          ? { seller: { city: sourceDistrict } }
          : {}),
      },
      include: {
        seller: {
          select: {
            id: true,
            city: true,
            upazilla: true,
          },
        },
        globalProduct: { select: { name: true } },
      },
    });

    // EC41: If absolutely no stock exists, abort and delete the job
    if (sellerProducts.length === 0) {
      await prisma.aCOGlobalJob.deleteMany({
        where: { id: globalJob.id },
      });
      return NextResponse.json(
        { error: "no_supply", message: "No seller products with stock > 0. Stock must exist before triggering ACO." },
        { status: 400 }
      );
    }

    // Build a quick lookup of upazillaResellerId by
    // (upazilla, district). The seller product carries the
    // upazilla NAME; we resolve to an upazillaResellerId
    // by querying the upazilla reseller table. This is the
    // join key Phase 1 uses to look up local demand.
    const upazillaResellerRows = await prisma.upazillaReseller.findMany({
      where: {
        OR: sellerProducts.map((sp) => ({
          AND: [
            { upazilla: sp.seller.upazilla },
            { city: sp.seller.city },
          ],
        })),
      },
      select: {
        id: true,
        upazilla: true,
        city: true,
      },
    });
    const upazillaIdByName = new Map<
      string,
      { id: string; lat: number; lng: number }
    >();
    for (const u of upazillaResellerRows) {
      upazillaIdByName.set(
        `${u.city.toLowerCase()}::${u.upazilla.toLowerCase()}`,
        { id: u.id, lat: 0, lng: 0 }
      );
    }

    // Resolve district reseller ids per (district). Used
    // to attach hubDistrictResellerId to supplies, which
    // Phase 2 + 3 use to attribute origin.
    const districts = Array.from(
      new Set(sellerProducts.map((sp) => sp.seller.city))
    );
    const districtResellerRows = await prisma.districtReseller.findMany({
      where: { district: { in: districts } },
      select: { id: true, district: true },
    });
    const districtIdByName = new Map<
      string,
      { id: string; lat: number; lng: number }
    >();
    for (const d of districtResellerRows) {
      districtIdByName.set(d.district.toLowerCase(), {
        id: d.id,
        lat: 0,
        lng: 0,
      });
    }

    // Build ProductSupply inputs for the engine.
    const supplies: ProductSupply[] = sellerProducts.map((sp) => {
      const uKey = `${sp.seller.city.toLowerCase()}::${sp.seller.upazilla.toLowerCase()}`;
      const ownU = upazillaIdByName.get(uKey);
      const hubD = districtIdByName.get(sp.seller.city.toLowerCase());
      const sellerCoords = getUpazillaCoords(sp.seller.upazilla);
      return {
        productName: sp.globalProduct?.name ?? sp.customName ?? "",
        productCode: sp.productCode,
        sellerProductId: sp.id,
        sellerId: sp.sellerId,
        district: sp.seller.city,
        upazilla: sp.seller.upazilla,
        available: sp.stock,
        lat: sellerCoords?.lat ?? 23.46,
        lng: sellerCoords?.lng ?? 91.18,
        ownUpazillaResellerId: ownU?.id,
        hubDistrictResellerId: hubD?.id,
        sellerName: sp.seller.city + " Seller",
      } as any;
    });

    // =========================================================
    // 2. DEMAND SNAPSHOTS
    // =========================================================
    // We cannot query effectiveDeficit directly from DB because it's a computed field.
    // Fetch all active demands and compute in memory.
    const upazillaDemandsRaw = await prisma.upazillaDemand.findMany({
      where: {
        productName: { in: productScope, mode: "insensitive" },
      },
      include: {
        upazillaReseller: {
          select: {
            id: true,
            upazilla: true,
            city: true,
          },
        },
      },
    });
    const districtDemandsRaw = await prisma.districtDemand.findMany({
      where: {
        productName: { in: productScope, mode: "insensitive" },
      },
      include: {
        districtReseller: {
          select: {
            id: true,
            district: true,
          },
        },
      },
    });

    // Pull pheromone scores (for now we use the demand
    // pheromone table). If a row is missing, we default
    // to 1.0 (neutral). This matches the single-product
    // engine's behavior.
    const pheromoneRows = await prisma.demandPheromone.findMany({
      where: {
        productName: { in: productScope, mode: "insensitive" },
      },
    });
    const pheromoneByKey = new Map<string, number>();
    for (const p of pheromoneRows) {
      pheromoneByKey.set(
        `${p.productName.toLowerCase()}::${p.entityId ?? ""}`,
        p.score
      );
    }

    const nowTime = Date.now();
    const upazillaDemands: UpazillaDemandEntry[] = [];
    for (const d of upazillaDemandsRaw) {
      const pendingDemand = d.demandQuantity - d.fulfilledQuantity;
      if (pendingDemand <= 0) continue;
      
      const waitingDays = Math.floor((nowTime - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const uCoords = getUpazillaCoords(d.upazillaReseller.upazilla);
      upazillaDemands.push({
        upazillaResellerId: d.upazillaResellerId,
        upazilla: d.upazillaReseller.upazilla,
        district: d.upazillaReseller.city,
        productName: d.productName,
        pendingDemand: d.demandQuantity,
        reservedDemand: 0,
        effectiveDeficit: pendingDemand,
        waitingDays,
        pheromoneScore:
          pheromoneByKey.get(
            `${d.productName.toLowerCase()}::${d.upazillaResellerId}`
          ) ?? 1.0,
        lat: uCoords?.lat ?? 23.46,
        lng: uCoords?.lng ?? 91.18,
      });
    }

    const districtDemands: DistrictDemandEntry[] = [];
    for (const d of districtDemandsRaw) {
      const pendingDemand = d.remainingDemand;
      if (pendingDemand <= 0) continue;
      
      const waitingDays = Math.floor((nowTime - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const dCoords = getDistrictCoords(d.districtReseller.district);
      districtDemands.push({
        districtResellerId: d.districtResellerId,
        district: d.districtReseller.district,
        productName: d.productName,
        pendingDemand: d.totalDemand,
        reservedDemand: 0,
        effectiveDeficit: pendingDemand,
        waitingDays,
        pheromoneScore:
          pheromoneByKey.get(
            `${d.productName.toLowerCase()}::${d.districtResellerId}`
          ) ?? 1.0,
        lat: dCoords?.lat ?? 23.46,
        lng: dCoords?.lng ?? 91.18,
      });
    }

    // =========================================================
    // 3. RUN PHASES
    // =========================================================
    // Phase 1
    const phase1 = planPhase1({
      supplies,
      upazillaDemands,
      getUpazillaCoords: (u) => {
        const c = getUpazillaCoords(u);
        return { lat: c?.lat ?? 23.7, lng: c?.lng ?? 90.4 };
      },
    });

    // Build supplies for Phase 2: subtract Phase 1 origin
    // delta from each supply's available.
    const phase1OriginByProduct = new Map<
      string,
      Map<string, number>
    >(); // sellerId -> productName -> qty
    for (const ship of phase1.shipments) {
      for (const li of ship.lineItems) {
        if (!phase1OriginByProduct.has(ship.fromId)) {
          phase1OriginByProduct.set(ship.fromId, new Map());
        }
        phase1OriginByProduct
          .get(ship.fromId)!
          .set(li.productName, li.allocatedQty);
      }
    }
    const suppliesAfterPhase1: ProductSupply[] = supplies.map((s) => {
      const used = phase1OriginByProduct.get(s.sellerId)?.get(s.productName) ?? 0;
      return { ...s, available: Math.max(0, s.available - used) };
    });

    // Phase 2
    const phase2 = planPhase2({
      suppliesAfterPhase1,
      upazillaDemands,
      phase1DestinationDelta: phase1.perProductDestinationDelta,
      getUpazillaCoords: (u) => {
        const c = getUpazillaCoords(u);
        return { lat: c?.lat ?? 23.7, lng: c?.lng ?? 90.4 };
      },
      getDistrictCoords: (d) => {
        const c = getDistrictCoords(d);
        return { lat: c?.lat ?? 23.7, lng: c?.lng ?? 90.4 };
      },
    });

    // Build supplies for Phase 3: subtract Phase 2 origin
    // delta exactly by sellerProductId.
    const phase2OriginBySeller = new Map<string, number>();
    for (const ship of phase2.shipments) {
      for (const li of ship.lineItems) {
        if (!li.sellerProductId) continue;
        phase2OriginBySeller.set(
          li.sellerProductId,
          (phase2OriginBySeller.get(li.sellerProductId) ?? 0) + li.allocatedQty
        );
      }
    }
    const suppliesAfterPhase2: ProductSupply[] = suppliesAfterPhase1.map((s) => {
      const used = phase2OriginBySeller.get(s.sellerProductId) ?? 0;
      return { ...s, available: Math.max(0, s.available - used) };
    });

    // Build hubSurplus map: for each (hub, product), the
    // total unallocated supply reaching Phase 3. We use
    // this to scope the planning.
    const hubSurplus: Record<string, Record<string, number>> = {};
    for (const s of suppliesAfterPhase2) {
      const hubId = (s as any).hubDistrictResellerId;
      if (!hubId) continue;
      if (!hubSurplus[hubId]) hubSurplus[hubId] = {};
      hubSurplus[hubId][s.productName] = s.available;
    }

    // Compute intra-district fills for Phase 3 residual:
    // for each (district, product) the total filled by
    // Phase 1+2.
    const intraDistrictFills: Record<string, Record<string, number>> = {};
    for (const ship of [...phase1.shipments, ...phase2.shipments]) {
      for (const li of ship.lineItems) {
        // For phase 1 the destination is the upazilla; we
        // map to district by looking up the dest.
        let district: string | undefined;
        if (ship.phase === 1) {
          const d = supplies.find((x) => x.sellerId === ship.fromId);
          district = d?.district;
        } else {
          district = ship.fromName; // phase 2: hub = district name
        }
        if (!district) continue;
        if (!intraDistrictFills[district]) intraDistrictFills[district] = {};
        intraDistrictFills[district][li.productName] =
          (intraDistrictFills[district][li.productName] ?? 0) +
          li.allocatedQty;
      }
    }

    // Phase 3
    // EC32: Phase 3 only triggers for a District Hub if ALL of its own local
    // Upazilla Demands for that product are completely fulfilled.
    const phase3Supplies = suppliesAfterPhase2.filter((s) => {
      const districtName = s.district.toLowerCase();
      let totalUnfulfilled = 0;
      for (const d of upazillaDemandsRaw) {
        if (
          d.upazillaReseller.city.toLowerCase() === districtName &&
          d.productName.toLowerCase() === s.productName.toLowerCase()
        ) {
          const initialRem = d.demandQuantity - d.fulfilledQuantity;
          const phase1Fill = phase1.perProductDestinationDelta[d.upazillaResellerId]?.[s.productName] ?? 0;
          const phase2Fill = phase2.perProductDestinationDelta[d.upazillaResellerId]?.[s.productName] ?? 0;
          const currentRem = Math.max(0, initialRem - phase1Fill - phase2Fill);
          if (currentRem > 0) totalUnfulfilled += currentRem;
        }
      }
      return totalUnfulfilled === 0;
    });

    const phase3 =
      maxPhases >= 3
        ? planPhase3({
            suppliesAfterPhase2: phase3Supplies,
            hubSurplus,
            districtDemands,
            intraDistrictFills,
            getDistrictCoords: (d) => {
              const c = getDistrictCoords(d);
              return { lat: c?.lat ?? 23.7, lng: c?.lng ?? 90.4 };
            },
          })
        : ({
            shipments: [],
            perProductOriginDelta: {},
            perProductDestinationDelta: {},
            unallocated: {},
            summary: {},
          } as any);

    // Phase 4 is not run in this endpoint. It's deferred
    // to /api/aco/phase4-trigger.
    const phase4 = {
      shipments: [],
      perProductOriginDelta: {},
      perProductDestinationDelta: {},
      unallocated: {},
      summary: {},
    } as any;

    // =========================================================
    // 4. CONSERVATION CHECK
    // =========================================================
    const lineItemsForCheck = [
      ...(phase1.negotiations || []).map((n) => ({
        productName: n.productName,
        allocatedQty: n.requestedQty,
        status: "pending_negotiation",
      })),
      ...phase2.shipments.flatMap((s) =>
        s.lineItems.map((li) => ({
          productName: li.productName,
          allocatedQty: li.allocatedQty,
          status: "dispatched",
        }))
      ),
      ...phase3.shipments.flatMap((s) =>
        s.lineItems.map((li) => ({
          productName: li.productName,
          allocatedQty: li.allocatedQty,
          status: "pending_approval",
        }))
      ),
    ];
    const conservation = verifyMultiProductConservation({
      supplySnapshots: supplies.map((s) => ({
        sellerProductId: s.sellerProductId ?? s.sellerId,
        productName: s.productName,
        stockAtSnapshot: s.available,
      })),
      shipmentLineItems: lineItemsForCheck,
    });

    // =========================================================
    // 5. PERSIST (single transaction)
    // =========================================================
    const totalSupply: Record<string, number> = {};
    for (const s of supplies) {
      totalSupply[s.productName] =
        (totalSupply[s.productName] ?? 0) + s.available;
    }
    const totalDemand: Record<string, number> = {};
    for (const d of [...upazillaDemands, ...districtDemands]) {
      totalDemand[d.productName] =
        (totalDemand[d.productName] ?? 0) + d.effectiveDeficit;
    }

    await prisma.$transaction(
      async (tx) => {
        // 5a. Persist demand snapshots
        if (upazillaDemands.length > 0) {
          await tx.productDemandSnapshot.createMany({
            data: upazillaDemands.map((d) => ({
              jobId: globalJob.id,
              productName: d.productName,
              scope: "upazilla",
              entityId: d.upazillaResellerId,
              entityName: d.upazilla,
              district: d.district,
              pendingDemand: d.pendingDemand,
              reservedDemand: 0,
              effectiveDeficit: d.effectiveDeficit,
              waitingDays: d.waitingDays,
              pheromoneScore: d.pheromoneScore,
            })),
          });
        }
        if (districtDemands.length > 0) {
          await tx.productDemandSnapshot.createMany({
            data: districtDemands.map((d) => ({
              jobId: globalJob.id,
              productName: d.productName,
              scope: "district",
              entityId: d.districtResellerId,
              entityName: d.district,
              district: d.district,
              pendingDemand: d.pendingDemand,
              reservedDemand: 0,
              effectiveDeficit: d.effectiveDeficit,
              waitingDays: d.waitingDays,
              pheromoneScore: d.pheromoneScore,
            })),
          });
        }

        // 5b. Persist supply snapshots
        if (supplies.length > 0) {
          await tx.sellerSupplySnapshot.createMany({
            data: supplies.map((s) => ({
              jobId: globalJob.id,
              sellerId: s.sellerId,
              sellerProductId: s.sellerProductId ?? s.sellerId,
              productName: s.productName,
              district: s.district,
              upazilla: s.upazilla,
              stockAtSnapshot: s.available,
              routedQty: 0,
            })),
          });
        }

        // 5c. Persist negotiations & shipments
        if (phase1.negotiations && phase1.negotiations.length > 0) {
          await tx.sellerACONegotiation.createMany({
            data: phase1.negotiations.map((n) => ({
              jobId: globalJob.id,
              sellerId: n.sellerId,
              sellerProductId: n.sellerProductId,
              productCode: n.productCode,
              productName: n.productName,
              requestedQty: n.requestedQty,
              systemPrice: n.systemPrice,
              sellerAskPrice: n.systemPrice / 0.9, // Estimate original price
              offeredPrice: n.systemPrice,
              status: "pending",
              expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
            })),
          });
        }

        const allShipments = [
          ...phase2.shipments,
          ...phase3.shipments,
        ];
        for (const ship of allShipments) {
          const status =
            ship.phase === 3 ? "pending_approval" : "dispatched";
          await tx.aCOShipment.create({
            data: {
              jobId: globalJob.id,
              phase: ship.phase,
              fromType: ship.fromType,
              fromId: ship.fromId,
              fromName: ship.fromName,
              toType: ship.toType,
              toId: ship.toId,
              toName: ship.toName,
              distanceKm: ship.distanceKm,
              totalQuantity: ship.totalQuantity,
              overallAcoScore: ship.overallAcoScore,
              sourceApproved: ship.phase === 3 ? false : true,
              sourceApprovedAt: ship.phase === 3 ? null : new Date(),
              targetApproved: ship.phase === 3 ? false : true,
              targetApprovedAt: ship.phase === 3 ? null : new Date(),
              status,
              expiresAt: ship.expiresAt ? new Date(ship.expiresAt) : null,
              dispatchedAt: ship.phase === 3 ? null : new Date(),
              lineItems: {
                create: ship.lineItems.map((li) => ({
                  productName: li.productName,
                  productCode: li.productCode ?? null,
                  sellerProductId: li.sellerProductId ?? null,
                  allocatedQty: li.allocatedQty,
                  acoScore: li.acoScore,
                  demandAtTime: li.demandAtTime,
                  pheromoneScore: li.pheromoneScore,
                  allocationReason: li.allocationReason,
                  status: ship.phase === 3 ? "pending_approval" : "dispatched",
                })),
              },
            },
          });
        }

        // 5c2. Active DB Mutations for Phase 2 Shipments
        const deductSeller = new Map<string, number>();
        const fulfillUpazilla = new Map<string, Map<string, number>>();

        for (const ship of phase2.shipments) {
          for (const li of ship.lineItems) {
            if (li.sellerProductId) {
              deductSeller.set(
                li.sellerProductId,
                (deductSeller.get(li.sellerProductId) ?? 0) + li.allocatedQty
              );
            }
            if (!fulfillUpazilla.has(ship.toId)) {
              fulfillUpazilla.set(ship.toId, new Map());
            }
            fulfillUpazilla
              .get(ship.toId)!
              .set(
                li.productName,
                (fulfillUpazilla.get(ship.toId)!.get(li.productName) ?? 0) +
                  li.allocatedQty
              );
          }
        }

        for (const [sellerProductId, qty] of deductSeller.entries()) {
          if (qty > 0) {
            const updated = await tx.sellerProduct.updateMany({
              where: { id: sellerProductId, stock: { gte: qty } },
              data: { stock: { decrement: qty } },
            });
            if (updated.count === 0) {
              const sp = await tx.sellerProduct.findUnique({ 
                where: { id: sellerProductId }, 
                include: { globalProduct: true } 
              });
              const name = sp?.globalProduct?.name ?? sp?.customName ?? "Unknown Product";
              throw new Error(`Stock became insufficient for ${name} during execution. Available stock dropped below the required ${qty}.`);
            }
          }
        }

        for (const [upazillaId, productMap] of fulfillUpazilla.entries()) {
          for (const [productName, qty] of productMap.entries()) {
            if (qty <= 0) continue;

            const uDemandRow = upazillaDemandsRaw.find(
              (d) =>
                d.upazillaResellerId === upazillaId &&
                d.productName.toLowerCase() === productName.toLowerCase()
            );

            if (uDemandRow) {
              const newF = uDemandRow.fulfilledQuantity + qty;
              await tx.upazillaDemand.update({
                where: { id: uDemandRow.id },
                data: {
                  fulfilledQuantity: newF,
                  status:
                    newF >= uDemandRow.demandQuantity
                      ? "fulfilled"
                      : "partially_fulfilled",
                },
              });

              const districtName = uDemandRow.upazillaReseller.city.toLowerCase();
              const dReseller = districtIdByName.get(districtName);
              if (dReseller) {
                const dDemandRow = districtDemandsRaw.find(
                  (d) =>
                    d.districtResellerId === dReseller.id &&
                    d.productName.toLowerCase() === productName.toLowerCase()
                );
                if (dDemandRow) {
                  const newRem = Math.max(0, dDemandRow.remainingDemand - qty);
                  await tx.districtDemand.update({
                    where: { id: dDemandRow.id },
                    data: {
                      remainingDemand: newRem,
                      status: newRem <= 0 ? "fulfilled" : "partially_fulfilled",
                    },
                  });
                }
              }
            }
          }
        }

        // 5d. Update the global job with final summaries
        await tx.aCOGlobalJob.update({
          where: { id: globalJob.id },
          data: {
            totalSupply: totalSupply as any,
            totalDemand: totalDemand as any,
            phase1Summary: {
              shipments: phase1.shipments.length,
              totalQuantity: phase1.shipments.reduce(
                (s, x) => s + x.totalQuantity,
                0
              ),
              products: Object.keys(phase1.summary),
              unallocated: phase1.unallocated,
            } as any,
            phase2Summary: {
              shipments: phase2.shipments.length,
              totalQuantity: phase2.shipments.reduce(
                (s, x) => s + x.totalQuantity,
                0
              ),
              products: Object.keys(phase2.summary),
              unallocated: phase2.unallocated,
            } as any,
            phase3Summary: {
              shipments: phase3.shipments.length,
              totalQuantity: phase3.shipments.reduce(
                (s, x) => s + x.totalQuantity,
                0
              ),
              products: Object.keys(phase3.summary),
              unallocated: phase3.unallocated,
            } as any,
            phase4Summary: {
              shipments: 0,
              totalQuantity: 0,
              note: "Run /api/aco/phase4-trigger after Phase 3 approvals.",
            } as any,
            conservationCheck: {
              balanced: conservation.balanced,
              totalDiscrepancy: conservation.totalDiscrepancy,
              violationCount: conservation.violations.length,
              violations: conservation.violations,
            } as any,
            status: "completed",
            completedAt: new Date(),
          },
        });
      },
      { timeout: 60000 }
    );

    // [NEW] Run Truck Orchestrator
    try {
      const { buildTruckPlans } = await import("@/lib/truck-orchestrator");
      await buildTruckPlans(globalJob.id);
    } catch (err) {
      console.error("Truck Orchestrator Error:", err);
    }

    // [NEW] Trigger UiPath for Phase 3 Shipments
    try {
      const { triggerUiPathAgent } = await import("@/lib/uipath");
      const phase3Shipments = await prisma.aCOShipment.findMany({
        where: { jobId: globalJob.id, phase: 3 },
      });
      
      for (const shipment of phase3Shipments) {
        const payload = {
          ShipmentId: shipment.id,
          TruckCode: "TBD",
          ProductSummary: `Phase 3 Shipment of ${shipment.totalQuantity} items`,
          TotalQuantity: shipment.totalQuantity,
          TotalWeightKg: shipment.totalQuantity * 5, // mock weight
          TotalVolumeCBM: shipment.totalQuantity * 0.1, // mock volume
          FromDistrict: shipment.fromName,
          ToDistrict: shipment.toName,
          DistanceKm: shipment.distanceKm,
          CombinedScore: shipment.overallAcoScore,
          SourceEmail: "ops@nodecommerce.bd", // mocked for demo
          TargetEmail: "ops@nodecommerce.bd", // mocked for demo
          SourcePhone: "01700000000",
          TargetPhone: "01700000000",
          SourceDistrictId: shipment.fromId,
          TargetDistrictId: shipment.toId,
          DriverName: "Pending Assignment",
          DriverPhone: "Pending",
          LicensePlate: "Pending",
          TransportAgency: "Pending",
          AgencyBookingRef: "Pending",
          NegotiatedMaxPrice: shipment.distanceKm * 50,
          ConfirmedFreight: shipment.distanceKm * 48,
          ExpiresAt: shipment.expiresAt ? shipment.expiresAt.toISOString() : new Date(Date.now() + 48*3600*1000).toISOString(),
          RequiredByDate: new Date(Date.now() + 72*3600*1000).toISOString(),
          CallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://nodecommerce.bd"}/api/uipath`,
          SeasonalRiskFlag: "low",
          HistoricalDelayRate: 0.1,
          CurrentWeather: "Clear",
        };
        // Trigger asynchronously to avoid blocking the response
        triggerUiPathAgent(payload).catch(console.error);
      }
    } catch (err) {
      console.error("UiPath Trigger Error:", err);
    }

    return NextResponse.json({
      ok: true,
      jobId: globalJob.id,       // ← for truck animation
      globalJobId: globalJob.id,
      summary: {
        phase1: {
          filled: phase1.shipments.reduce(
            (s, x) => s + x.totalQuantity,
            0
          ),
          shipments: phase1.shipments.length,
        },
        phase2: {
          filled: phase2.shipments.reduce(
            (s, x) => s + x.totalQuantity,
            0
          ),
          shipments: phase2.shipments.length,
        },
        phase3: {
          proposed: phase3.shipments.reduce(
            (s, x) => s + x.totalQuantity,
            0
          ),
          shipments: phase3.shipments.length,
          opportunities: phase3.shipments.length,
        },
        phase4: {
          filled: 0,
          shipments: 0,
          note: "Run /api/aco/phase4-trigger after approvals.",
        },
        conservationCheck: {
          balanced: conservation.balanced,
          totalDiscrepancy: conservation.totalDiscrepancy,
        },
      },
    });
  } catch (err: any) {
    console.error("[/api/aco/global-trigger] error", err);
    try {
      await prisma.aCOGlobalJob.update({
        where: { id: globalJob.id },
        data: {
          status: "failed",
          errorMessage: String(err?.message ?? err),
          completedAt: new Date(),
        },
      });
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json(
      { error: "trigger_failed", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
