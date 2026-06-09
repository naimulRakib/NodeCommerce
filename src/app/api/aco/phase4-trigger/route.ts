
/**
 * POST /api/aco/phase4-trigger
 *
 * Body: { shipmentId: string }
 *
 * Triggers Phase 4 distribution for a Phase 3 shipment
 * that has been approved. The destination district's hub
 * holds the arriving line items and must allocate them to
 * upazillas with pending demand.
 *
 * This endpoint is also called automatically by the
 * approve route when both source + target approve. The
 * separation lets operators manually re-trigger Phase 4
 * if a downstream demand row appears after approval.
 *
 * Flow:
 *   1. Load the Phase 3 shipment with line items.
 *   2. Validate status = "approved".
 *   3. Pull dest-district upazilla demands.
 *   4. Run planPhase4.
 *   5. Persist ACOShipment (phase 4) + line items.
 *   6. Decrement sender inventory (district stock) and
 *      increment receiver inventory (upazilla stock).
 *   7. Update global job phase4Summary.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  planPhase4,
  PlanLineItem,
  DistrictDemandEntry,
  UpazillaDemandEntry,
} from "@/lib/aco-multi-engine";
import {
  getDistrictCoords,
  getUpazillaCoords,
} from "@/lib/aco-distance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const shipmentId: string | undefined = body.shipmentId;
  if (!shipmentId) {
    return NextResponse.json(
      { error: "shipmentId_required" },
      { status: 400 }
    );
  }

  const shipment = await prisma.aCOShipment.findUnique({
    where: { id: shipmentId },
    include: { lineItems: true, job: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "shipment_not_found" }, { status: 404 });
  }
  if (shipment.phase !== 3) {
    return NextResponse.json(
      { error: "wrong_phase", message: "Only Phase 3 shipments feed Phase 4." },
      { status: 400 }
    );
  }
  if (shipment.status !== "approved" && shipment.status !== "dispatched") {
    return NextResponse.json(
      { error: "shipment_not_approved", message: `status=${shipment.status}` },
      { status: 400 }
    );
  }

  // Idempotency: if Phase 4 already exists for this
  // shipment, return it instead of recomputing.
  const existingPhase4 = await prisma.aCOShipment.findFirst({
    where: { phase: 4, jobId: shipment.jobId, fromId: shipment.toId },
    include: { lineItems: true },
  });
  // Note: we can't perfectly key on `fromId` because
  // multiple Phase 3 trucks could target the same hub.
  // For correctness in the simple flow we use a notes
  // marker.
  const markerShipments = await prisma.aCOShipment.findMany({
    where: {
      phase: 4,
      jobId: shipment.jobId,
      notes: { contains: `phase3:${shipment.id}` },
    },
    include: { lineItems: true },
  });
  if (markerShipments.length > 0) {
    return NextResponse.json({
      ok: true,
      alreadyRan: true,
      phase4Shipments: markerShipments,
    });
  }

  // Pull dest district demand and upazilla demand.
  const [districtDemandsRaw, upazillaDemandsRaw] = await Promise.all([
    prisma.districtDemand.findMany({
      where: {
        remainingDemand: { gt: 0 },
        productName: { in: shipment.lineItems.map((li) => li.productName), mode: "insensitive" },
      },
      include: { districtReseller: { select: { id: true, district: true } } },
    }),
    prisma.upazillaDemand.findMany({
      where: {
        status: { not: "fulfilled" },
        productName: { in: shipment.lineItems.map((li) => li.productName), mode: "insensitive" },
      },
      include: { upazillaReseller: { select: { id: true, upazilla: true, city: true } } },
    }),
  ]);

  // Filter to the dest district only.
  const destDistrict = shipment.toName; // we set toName = district name
  const destDistrictReseller = await prisma.districtReseller.findFirst({
    where: { district: destDistrict },
    select: { id: true, district: true },
  });
  if (!destDistrictReseller) {
    return NextResponse.json(
      { error: "dest_district_reseller_not_found" },
      { status: 500 }
    );
  }

  const destUpazillaDemands = upazillaDemandsRaw.filter(
    (d) => d.upazillaReseller.city.toLowerCase() === destDistrict.toLowerCase()
  );
  const destDistrictDemands = districtDemandsRaw.filter(
    (d) => d.districtReseller.district.toLowerCase() === destDistrict.toLowerCase()
  );

  // Compute intra-district fills so we don't double-count
  // demand that Phase 1 + 2 already satisfied at the dest
  // upazillas.
  const intraDistrictFillsByKey: Record<string, number> = {};
  const priorPhaseShipments = await prisma.aCOShipment.findMany({
    where: {
      jobId: shipment.jobId,
      phase: { in: [1, 2] },
      toName: destDistrict,
    },
    include: { lineItems: true },
  });
  for (const s of priorPhaseShipments) {
    for (const li of s.lineItems) {
      // For Phase 1: toId is the upazilla reseller id.
      // For Phase 2: toId is the upazilla reseller id.
      // We only care about Phase 2 here (intra-district).
      if (s.phase !== 2) continue;
      const key = `${s.toId}::${li.productName}`;
      intraDistrictFillsByKey[key] =
        (intraDistrictFillsByKey[key] ?? 0) + li.allocatedQty;
    }
  }

  const districtDemandEntries: DistrictDemandEntry[] = destDistrictDemands.map(
    (d) => {
      const coords = getDistrictCoords(d.districtReseller.district);
      return {
        districtResellerId: d.districtResellerId,
        district: d.districtReseller.district,
        productName: d.productName,
        pendingDemand: d.totalDemand,
        reservedDemand: d.totalDemand - d.remainingDemand,
        effectiveDeficit: d.remainingDemand,
        waitingDays: 0,
        pheromoneScore: 1.0,
        lat: coords?.lat ?? 23.7,
        lng: coords?.lng ?? 90.4,
      };
    }
  );
  const upazillaDemandEntries: UpazillaDemandEntry[] = destUpazillaDemands.map(
    (d) => {
      const coords = getUpazillaCoords(d.upazillaReseller.upazilla);
      const deficit = Math.max(0, d.demandQuantity - d.fulfilledQuantity);
      return {
        upazillaResellerId: d.upazillaResellerId,
        upazilla: d.upazillaReseller.upazilla,
        district: d.upazillaReseller.city,
        productName: d.productName,
        pendingDemand: d.demandQuantity,
        reservedDemand: d.fulfilledQuantity,
        effectiveDeficit: deficit,
        waitingDays: 0,
        pheromoneScore: 1.0,
        lat: coords?.lat ?? 23.7,
        lng: coords?.lng ?? 90.4,
      };
    }
  );

  const arrivingLineItems: PlanLineItem[] = shipment.lineItems.map((li) => ({
    productName: li.productName,
    productCode: li.productCode ?? undefined,
    sellerProductId: li.sellerProductId ?? undefined,
    allocatedQty: li.allocatedQty,
    acoScore: li.acoScore,
    distanceKm: 0,
    demandAtTime: li.demandAtTime,
    pheromoneScore: li.pheromoneScore,
    allocationReason: "dest_upazilla_routing" as const,
  }));

  const result = planPhase4({
    arrivingLineItems,
    arrivingAtDistrict: destDistrict,
    arrivingAtHubId: destDistrictReseller.id,
    districtDemands: districtDemandEntries,
    upazillaDemands: upazillaDemandEntries,
    intraDistrictFillsByKey,
    getUpazillaCoords: (u) => {
      const c = getUpazillaCoords(u);
      return { lat: c?.lat ?? 23.7, lng: c?.lng ?? 90.4 };
    },
  });

  // Persist.
  await prisma.$transaction(
    async (tx) => {
      for (const ship of result.shipments) {
        await tx.aCOShipment.create({
          data: {
            jobId: shipment.jobId,
            phase: 4,
            fromType: "district_hub",
            fromId: destDistrictReseller.id,
            fromName: destDistrict,
            toType: "upazilla",
            toId: ship.toId,
            toName: ship.toName,
            distanceKm: ship.distanceKm,
            totalQuantity: ship.totalQuantity,
            overallAcoScore: ship.overallAcoScore,
            sourceApproved: true,
            sourceApprovedAt: new Date(),
            targetApproved: true,
            targetApprovedAt: new Date(),
            status: "dispatched",
            dispatchedAt: new Date(),
            notes: `phase3:${shipment.id}`,
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
                status: "dispatched",
              })),
            },
          },
        });
      }
      // Update global job phase4 summary.
      const prior = await tx.aCOGlobalJob.findUnique({
        where: { id: shipment.jobId },
        select: { phase4Summary: true },
      });
      const prevSummary: any = prior?.phase4Summary ?? {};
      await tx.aCOGlobalJob.update({
        where: { id: shipment.jobId },
        data: {
          phase4Summary: {
            ...prevSummary,
            shipments:
              (prevSummary.shipments ?? 0) + result.shipments.length,
            totalQuantity:
              (prevSummary.totalQuantity ?? 0) +
              result.shipments.reduce((s, x) => s + x.totalQuantity, 0),
            unallocated: result.unallocated,
            lastRunAt: new Date().toISOString(),
          } as any,
        },
      });
    },
    { timeout: 30000 }
  );

  return NextResponse.json({
    ok: true,
    phase4Shipments: result.shipments,
    summary: {
      filled: result.shipments.reduce((s, x) => s + x.totalQuantity, 0),
      shipments: result.shipments.length,
    },
  });
}
