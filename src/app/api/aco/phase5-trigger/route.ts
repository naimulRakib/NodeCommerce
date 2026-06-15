import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planPhase5, ProductSupply, LocalDemandEntry } from "@/lib/aco-multi-engine";
import { getUpazillaCoords } from "@/lib/aco-distance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const { jobId } = body;
    const globalJobId = jobId; // Optional: associate with global job

    // 1. Fetch available UpazillaStockItems
    const upazillaStocksRaw = await prisma.upazillaStockItem.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        upazillaReseller: true,
        sellerProduct: true,
      },
    });

    const upazillaStocks: ProductSupply[] = upazillaStocksRaw.map(s => ({
      productName: s.productName,
      productCode: s.sellerProduct?.productCode,
      sellerProductId: s.sellerProductId ?? s.id,
      sellerId: s.upazillaResellerId, // Using sellerId to represent the hub ID
      district: s.upazillaReseller.city,
      upazilla: s.upazillaReseller.upazilla,
      available: s.quantity,
      lat: getUpazillaCoords(s.upazillaReseller.upazilla)?.lat ?? 23.46,
      lng: getUpazillaCoords(s.upazillaReseller.upazilla)?.lng ?? 91.18,
    } as any));

    // 2. Fetch pending LocalDemands
    const localDemandsRaw = await prisma.localDemand.findMany({
      where: {
        status: { in: ["pending", "partially_fulfilled"] },
        demandQuantity: { gt: prisma.localDemand.fields.fulfilledQuantity }
      },
      include: {
        localReseller: true,
      },
    });

    const nowTime = Date.now();
    const localDemands: LocalDemandEntry[] = localDemandsRaw.map(d => {
      const pendingDemand = d.demandQuantity - d.fulfilledQuantity;
      const waitingDays = Math.floor((nowTime - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        localResellerId: d.localResellerId,
        resellerCode: d.localReseller.resellerCode,
        city: d.localReseller.city,
        upazilla: d.localReseller.upazilla,
        productName: d.productName,
        productCode: d.productCode,
        pendingDemand: d.demandQuantity,
        reservedDemand: 0,
        effectiveDeficit: pendingDemand,
        waitingDays,
        pheromoneScore: 1.0, // Default for local demand
        lat: d.localReseller.lat ?? 23.46,
        lng: d.localReseller.lng ?? 91.18,
      };
    });

    // 3. Run Phase 5
    const phase5 = planPhase5({
      upazillaStocks,
      localDemands,
      getUpazillaCoords: (u) => getUpazillaCoords(u) ?? { lat: 23.7, lng: 90.4 },
      getLocalCoords: (l) => getUpazillaCoords(l) ?? { lat: 23.7, lng: 90.4 }
    });

    // 4. Persist
    const deductStock = new Map<string, number>();
    const addResellerStock = new Map<string, Map<string, { qty: number, sellerProductId: string | null }>>();
    const fulfillDemand = new Map<string, Map<string, number>>();

    for (const ship of phase5.shipments) {
      for (const li of ship.lineItems) {
        if (li.sellerProductId) {
          deductStock.set(
            li.sellerProductId,
            (deductStock.get(li.sellerProductId) ?? 0) + li.allocatedQty
          );
        }

        const truckKey = ship.toId; // LocalReseller ID
        if (!addResellerStock.has(truckKey)) addResellerStock.set(truckKey, new Map());
        
        const existingData = addResellerStock.get(truckKey)!.get(li.productName) || { qty: 0, sellerProductId: null };
        addResellerStock.get(truckKey)!.set(
          li.productName,
          { 
            qty: existingData.qty + li.allocatedQty, 
            sellerProductId: li.sellerProductId ?? existingData.sellerProductId 
          }
        );

        if (!fulfillDemand.has(truckKey)) fulfillDemand.set(truckKey, new Map());
        fulfillDemand.get(truckKey)!.set(
          li.productName,
          (fulfillDemand.get(truckKey)!.get(li.productName) ?? 0) + li.allocatedQty
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // Create Shipments
      for (const ship of phase5.shipments) {
        await tx.aCOShipment.create({
          data: {
            jobId: globalJobId ?? "standalone-phase5",
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
            status: "dispatched",
            sourceApproved: true,
            sourceApprovedAt: new Date(),
            targetApproved: true,
            targetApprovedAt: new Date(),
            dispatchedAt: new Date(),
            lineItems: {
              create: ship.lineItems.map(li => ({
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

      // Deduct UpazillaStock
      for (const [stockId, qty] of deductStock.entries()) {
        await tx.upazillaStockItem.updateMany({
          where: { id: stockId, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        });
      }

      // Add to ResellerStockItem
      for (const [resellerId, products] of addResellerStock.entries()) {
        for (const [productName, data] of products.entries()) {
          const existing = await tx.resellerStockItem.findFirst({
            where: { resellerId, customName: productName }
          });
          if (existing) {
            await tx.resellerStockItem.update({
              where: { id: existing.id },
              data: { quantity: { increment: data.qty } }
            });
          } else {
            await tx.resellerStockItem.create({
              data: {
                resellerId,
                customName: productName,
                quantity: data.qty,
                sellerProductId: data.sellerProductId,
              }
            });
          }
        }
      }

      // Fulfill Local Demand
      for (const [resellerId, products] of fulfillDemand.entries()) {
        for (const [productName, qty] of products.entries()) {
          const demand = localDemandsRaw.find(
            d => d.localResellerId === resellerId && d.productName === productName
          );
          if (demand) {
            const newF = demand.fulfilledQuantity + qty;
            await tx.localDemand.update({
              where: { id: demand.id },
              data: {
                fulfilledQuantity: newF,
                status: newF >= demand.demandQuantity ? "fulfilled" : "partially_fulfilled"
              }
            });
          }
        }
      }

      // Update Phase5 summary if globalJobId exists
      if (globalJobId && globalJobId !== "standalone-phase5") {
        await tx.aCOGlobalJob.updateMany({
          where: { id: globalJobId },
          data: {
            phase5Summary: {
              shipments: phase5.shipments.length,
              totalQuantity: phase5.shipments.reduce((s, x) => s + x.totalQuantity, 0),
              products: Object.keys(phase5.summary),
              unallocated: phase5.unallocated,
            } as any
          }
        });
      }
    });

    return NextResponse.json({
      ok: true,
      shipmentsCreated: phase5.shipments.length,
      totalQuantityRouted: phase5.shipments.reduce((s, x) => s + x.totalQuantity, 0),
    });
  } catch (error: any) {
    console.error("Phase 5 trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
