import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/aco/reset
 * ────────────────────
 * Hard reset — deletes ALL ACO-related data:
 *   RealtimeAction, TruckStopItem, TruckStop, Truck,
 *   ACOShipmentItem, ACOShipment, SellerACONegotiation,
 *   ACOGlobalJob, ACOAllocation, ACORoutingJob, ACOTriggerLog
 *
 * Protected by X-Internal-Secret header.
 * Only callable from superdashboard UI or internal scripts.
 */

// This runs server-side only — safe to read private env vars
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-secret";

// In production you MUST set INTERNAL_SECRET in your environment.
// The dev fallback "dev-secret" is intentionally permissive for local dev.

export async function POST(request: Request) {
  // Auth: must supply correct secret header
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Delete in dependency order (children before parents)
    const results = await prisma.$transaction([
      prisma.realtimeAction.deleteMany({}),
      prisma.truckStopItem.deleteMany({}),
      prisma.truckStop.deleteMany({}),
      prisma.truck.deleteMany({}),
      prisma.aCOShipmentItem.deleteMany({}),
      prisma.aCOShipment.deleteMany({}),
      prisma.sellerACONegotiation.deleteMany({}),
      prisma.aCOGlobalJob.deleteMany({}),
      prisma.aCOAllocation.deleteMany({}),
      prisma.aCORoutingJob.deleteMany({}),
      prisma.aCOTriggerLog.deleteMany({}),
    ]);

    const [
      realtimeActions,
      truckStopItems,
      truckStops,
      trucks,
      shipmentItems,
      shipments,
      negotiations,
      globalJobs,
      allocations,
      routingJobs,
      triggerLogs,
    ] = results;

    return NextResponse.json({
      ok: true,
      message: "ACO data reset complete",
      deleted: {
        realtimeActions: realtimeActions.count,
        truckStopItems: truckStopItems.count,
        truckStops: truckStops.count,
        trucks: trucks.count,
        shipmentItems: shipmentItems.count,
        shipments: shipments.count,
        negotiations: negotiations.count,
        globalJobs: globalJobs.count,
        allocations: allocations.count,
        routingJobs: routingJobs.count,
        triggerLogs: triggerLogs.count,
      },
    });
  } catch (error: any) {
    console.error("ACO reset error:", error);
    return NextResponse.json(
      { error: "Reset failed", details: error.message },
      { status: 500 }
    );
  }
}
