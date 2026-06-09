import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/supply-chain/history-reset
 * ─────────────────────────────────────
 * Wipes ALL historical ACO / transfer / truck data but KEEPS:
 *   ✓ GlobalProduct  — product catalog
 *   ✓ SellerProduct  — seller stock and prices (seller's stock numbers preserved)
 *   ✓ UpazillaDemand — reseller product demands
 *   ✓ DistrictDemand — district-level aggregated demands
 *   ✓ All account records (Profile, UpazillaReseller, DistrictReseller, LocalReseller, BuyerProfile)
 *   ✓ Cart / Orders  — buyer purchase history untouched
 *
 * What gets wiped:
 *   ✗ All ACO jobs, shipments, negotiations, allocations
 *   ✗ All trucks and truck stops
 *   ✗ All transfers (stock, district, national)
 *   ✗ All stock at reseller warehouses (UpazillaStockItem, DistrictStockItem, ResellerStockItem)
 *   ✗ All pheromone trails
 *   ✗ All realtime actions / notifications
 *   ✗ All demand/supply snapshots
 *   ✗ Stock order negotiations
 *   ✗ UpazillaAvailableStock cache
 *
 * Protected by X-Internal-Secret header.
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
    const counts: Record<string, number> = {};

    const run = async (label: string, fn: () => Promise<{ count: number }>) => {
      const r = await fn();
      counts[label] = r.count;
    };

    // ── 1. ACO pipeline (deepest children first) ──
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

    // ── 2. Reseller warehouse stock (stock that was physically transferred) ──
    // These are reset so the next ACO cycle starts from zero transferred stock.
    // Original seller stock (SellerProduct.stock) is NOT touched.
    await run("upazillaStockItems",    () => prisma.upazillaStockItem.deleteMany({}));
    await run("districtStockItems",    () => prisma.districtStockItem.deleteMany({}));
    await run("resellerStockItems",    () => prisma.resellerStockItem.deleteMany({}));

    // ── 3. Transfers & negotiation history ──
    await run("stockTransfers",        () => prisma.stockTransfer.deleteMany({}));
    await run("districtTransfers",     () => prisma.districtTransfer.deleteMany({}));
    await run("nationalTransfers",     () => prisma.nationalTransfer.deleteMany({}));
    await run("stockOrderNegotiations",() => prisma.stockOrderNegotiation.deleteMany({}));
    await run("upazillaAvailableStock",() => prisma.upazillaAvailableStock.deleteMany({}));

    // ── 4. Pheromone trails ──
    await run("demandPheromones",      () => prisma.demandPheromone.deleteMany({}));
    await run("routePheromones",       () => prisma.routePheromone.deleteMany({}));

    // ── 5. Reset demand fulfillment counters so all demands show as fully pending ──
    // UpazillaDemand: reset fulfilledQuantity to 0, status to pending
    const upazillaReset = await prisma.upazillaDemand.updateMany({
      data: { fulfilledQuantity: 0, status: "pending" },
    });

    // DistrictDemand: reset remainingDemand = totalDemand, status = pending
    // No @@map so Prisma uses default table name "DistrictDemand"
    await prisma.$executeRawUnsafe(
      `UPDATE "DistrictDemand" SET "remainingDemand" = "totalDemand", "status" = 'pending'`
    );
    const districtResetCount = await prisma.districtDemand.count();

    counts["upazillaDemandsReset"]  = upazillaReset.count;
    counts["districtDemandsReset"]  = districtResetCount;

    const totalDeleted = Object.entries(counts)
      .filter(([k]) => !k.endsWith("Reset"))
      .reduce((a, [, v]) => a + v, 0);

    return NextResponse.json({
      ok: true,
      message: "ACO history reset complete — seller stock and demands preserved",
      totalDeleted,
      demandsResetToFresh: {
        upazilla: upazillaReset.count,
        district: districtResetCount,
      },
      breakdown: counts,
    });

  } catch (error: any) {
    console.error("History reset error:", error);
    return NextResponse.json(
      { error: "History reset failed", details: error.message },
      { status: 500 }
    );
  }
}
