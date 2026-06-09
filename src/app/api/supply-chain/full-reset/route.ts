import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/supply-chain/full-reset
 * ──────────────────────────────────
 * Wipes ALL transactional supply chain data:
 *   - All ACO pipeline data (jobs, shipments, trucks, negotiations)
 *   - All demands (upazilla, district, local)
 *   - All stock transfers and pheromone trails
 *   - All realtime actions
 *   - All allocations and routing jobs
 *
 * DOES NOT delete:
 *   - Seller accounts / profiles
 *   - GlobalProducts / SellerProducts (catalog stays)
 *   - Reseller accounts (upazilla, district, local)
 *   - ResellerStockItems (local reseller shelf stock stays)
 *   - Orders / Buyer data
 *
 * Protected by X-Internal-Secret.
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-secret";

export async function POST(request: Request) {
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Delete in strict dependency order
    const counts: Record<string, number> = {};

    const run = async (label: string, fn: () => Promise<{ count: number }>) => {
      try {
        const r = await fn();
        counts[label] = r.count;
      } catch (err: any) {
        console.warn(`Skipping ${label} reset:`, err.message);
        counts[label] = 0;
      }
    };

    // ── ACO pipeline ──
    await run("realtimeActions",       () => prisma.realtimeAction.deleteMany({}));
    await run("truckStopItems",        () => prisma.truckStopItem.deleteMany({}));
    await run("truckStops",            () => prisma.truckStop.deleteMany({}));
    await run("trucks",                () => prisma.truck.deleteMany({}));
    await run("acoShipmentItems",      () => prisma.aCOShipmentItem.deleteMany({}));
    await run("acoShipments",          () => prisma.aCOShipment.deleteMany({}));
    await run("sellerNegotiations",    () => prisma.sellerACONegotiation.deleteMany({}));
    await run("acoGlobalJobs",         () => prisma.aCOGlobalJob.deleteMany({}));
    await run("acoAllocations",        () => prisma.aCOAllocation.deleteMany({}));
    await run("acoRoutingJobs",        () => prisma.aCORoutingJob.deleteMany({}));
    await run("acoTriggerLogs",        () => prisma.aCOTriggerLog.deleteMany({}));
    await run("interDistrictOpps",     () => prisma.interDistrictOpportunity.deleteMany({}));
    await run("shipmentPlans",         () => prisma.shipmentPlan.deleteMany({}));
    await run("demandSnapshots",       () => prisma.productDemandSnapshot.deleteMany({}));
    await run("supplySnapshots",       () => prisma.sellerSupplySnapshot.deleteMany({}));

    // ── Demand ──
    await run("upazillaDemands",       () => prisma.upazillaDemand.deleteMany({}));
    await run("districtDemands",       () => prisma.districtDemand.deleteMany({}));
    await run("localDemands",          () => prisma.localDemand.deleteMany({}));

    // ── Transfers & stock orders ──
    await run("stockTransfers",        () => prisma.stockTransfer.deleteMany({}));
    await run("districtTransfers",     () => prisma.districtTransfer.deleteMany({}));
    await run("nationalTransfers",     () => prisma.nationalTransfer.deleteMany({}));
    await run("stockOrderNegotiations",() => prisma.stockOrderNegotiation.deleteMany({}));
    await run("upazillaAvailableStock",() => prisma.upazillaAvailableStock.deleteMany({}));

    // ── Pheromones ──
    await run("demandPheromones",      () => prisma.demandPheromone.deleteMany({}));
    await run("routePheromones",       () => prisma.routePheromone.deleteMany({}));

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      message: "Full supply chain reset complete",
      totalDeleted: total,
      breakdown: counts,
    });
  } catch (error: any) {
    console.error("Full reset error:", error);
    return NextResponse.json(
      { error: "Full reset failed", details: error.message },
      { status: 500 }
    );
  }
}
