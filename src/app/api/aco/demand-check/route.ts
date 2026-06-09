/**
 * GET /api/aco/demand-check
 *
 * Pre-flight for the multi-product global ACO trigger.
 * Read-only endpoint — safe to call from auto-refresh.
 *
 * Auth: requires valid session.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { getDistrictCoords } from "@/lib/aco-distance";

export const dynamic = "force-dynamic";

interface PerProductSummary {
  productName: string;
  totalPendingDemand: number;
  totalFulfilledDemand: number;
  totalEffectiveDeficit: number;
  totalAvailableSupply: number;
  netBalance: number;
  upazillaDemandCount: number;
  districtDemandCount: number;
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Pull upazilla demands with unfulfilled quantity
  const upazillaDemandsRaw = await prisma.upazillaDemand.findMany({
    where: {
      status: { not: "fulfilled" },
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

  // 2. Pull district demands with remaining demand
  const districtDemandsRaw = await prisma.districtDemand.findMany({
    where: {
      remainingDemand: { gt: 0 },
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

  // 3. Pull available seller stock (approved products with stock > 0)
  const sellerStocks = await prisma.sellerProduct.findMany({
    where: {
      stock: { gt: 0 },
      status: "approved",
    },
    include: {
      seller: {
        select: {
          id: true,
          city: true,
          upazilla: true,
          storeName: true,
        },
      },
      globalProduct: {
        select: { name: true },
      },
    },
  });

  // 4. Pending district transfers (in flight)
  const pendingTransfers = await prisma.districtTransfer.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 5. Last global ACO job summary
  const lastGlobalJob = await prisma.aCOGlobalJob.findFirst({
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      productScope: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });

  // 6. Pending Phase 3 shipments
  const pendingPhase3Shipments = await prisma.aCOShipment.findMany({
    where: { phase: 3, status: "pending_approval" },
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // ---------------------------------------------------------
  // AGGREGATE PER PRODUCT
  // ---------------------------------------------------------
  const perProduct = new Map<string, PerProductSummary>();

  function ensure(productName: string) {
    const k = productName.toLowerCase();
    if (!perProduct.has(k)) {
      perProduct.set(k, {
        productName,
        totalPendingDemand: 0,
        totalFulfilledDemand: 0,
        totalEffectiveDeficit: 0,
        totalAvailableSupply: 0,
        netBalance: 0,
        upazillaDemandCount: 0,
        districtDemandCount: 0,
      });
    }
    return perProduct.get(k)!;
  }

  for (const d of upazillaDemandsRaw) {
    const p = ensure(d.productName);
    const deficit = Math.max(0, d.demandQuantity - d.fulfilledQuantity);
    p.totalPendingDemand += d.demandQuantity;
    p.totalFulfilledDemand += d.fulfilledQuantity;
    p.totalEffectiveDeficit += deficit;
    p.upazillaDemandCount += 1;
  }

  for (const d of districtDemandsRaw) {
    const p = ensure(d.productName);
    p.totalPendingDemand += d.totalDemand;
    p.totalEffectiveDeficit += d.remainingDemand;
    p.districtDemandCount += 1;
  }

  for (const s of sellerStocks) {
    const productName = s.globalProduct?.name ?? s.customName;
    if (!productName) continue;
    const p = ensure(productName);
    p.totalAvailableSupply += s.stock;
  }

  // Compute net balance
  for (const p of perProduct.values()) {
    p.netBalance = p.totalAvailableSupply - p.totalEffectiveDeficit;
  }

  // Sort by deficit desc
  const productsArr = Array.from(perProduct.values()).sort((a, b) => {
    if (b.totalEffectiveDeficit !== a.totalEffectiveDeficit) {
      return b.totalEffectiveDeficit - a.totalEffectiveDeficit;
    }
    return b.totalPendingDemand - a.totalPendingDemand;
  });

  // Top districts by outstanding demand
  const districtTotals = new Map<
    string,
    { district: string; pendingDemand: number; deficit: number }
  >();
  for (const d of districtDemandsRaw) {
    const districtName = d.districtReseller.district;
    if (!districtTotals.has(districtName)) {
      districtTotals.set(districtName, { district: districtName, pendingDemand: 0, deficit: 0 });
    }
    const e = districtTotals.get(districtName)!;
    e.pendingDemand += d.totalDemand;
    e.deficit += d.remainingDemand;
  }
  const topDistricts = Array.from(districtTotals.values())
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 10);

  // Resolve coords for top districts
  for (const d of topDistricts) {
    const c = getDistrictCoords(d.district);
    (d as any).lat = c?.lat ?? null;
    (d as any).lng = c?.lng ?? null;
  }

  // Compute canTriggerACO and hasActiveDemand for the UI
  const hasActiveDemand = productsArr.some(p => p.totalEffectiveDeficit > 0);
  const hasSupply = sellerStocks.length > 0;
  const eligibleProducts = productsArr.filter(p => p.totalEffectiveDeficit > 0 && p.totalAvailableSupply > 0);

  return NextResponse.json({
    ok: true,
    hasActiveDemand,
    canTriggerACO: hasActiveDemand && hasSupply,
    eligibleProducts: eligibleProducts.map(p => p.productName),
    fetchedAt: new Date().toISOString(),
    productCount: productsArr.length,
    products: productsArr,
    topDistricts,
    pendingTransferCount: pendingTransfers.length,
    pendingPhase3Shipments: pendingPhase3Shipments.map((s) => ({
      id: s.id,
      fromName: s.fromName,
      toName: s.toName,
      totalQuantity: s.totalQuantity,
      expiresAt: s.expiresAt,
      lineItemCount: s.lineItems.length,
      lineItemSummary: s.lineItems.map((li) => ({
        productName: li.productName,
        qty: li.allocatedQty,
      })),
    })),
    lastGlobalJob,
  });
}
