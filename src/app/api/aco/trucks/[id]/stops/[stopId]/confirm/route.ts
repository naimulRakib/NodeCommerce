import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRealtimeAction } from "@/lib/realtime-notifier";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    const { id: truckId, stopId } = await params;
    const body = await request.json();
    const { action, items } = body;

    // In real app, verify current user matches stop.entityId
    const stop = await prisma.truckStop.findUnique({
      where: { id: stopId },
      include: { items: true, truck: true },
    });

    if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });

    if (stop.status !== "truck_arrived") {
      return NextResponse.json(
        { error: "Truck has not arrived yet. Cannot confirm before truck arrival." },
        { status: 400 }
      );
    }

    const itemMap = new Map(stop.items.map((i) => [i.id, i]));
    for (const reqItem of items) {
      const dbItem = itemMap.get(reqItem.stopItemId);
      if (!dbItem) return NextResponse.json({ error: `Item \${reqItem.stopItemId} not found in stop` }, { status: 400 });
      if (reqItem.confirmedQty > dbItem.plannedQty) {
        return NextResponse.json({ error: "confirmedQty cannot exceed plannedQty" }, { status: 400 });
      }
      if (reqItem.confirmedQty < 0) {
        return NextResponse.json({ error: "confirmedQty cannot be negative" }, { status: 400 });
      }
    }

    const { updatedStop, updatedItems, nextStop } = await prisma.$transaction(async (tx) => {
      const resItems = [];

      for (const reqItem of items) {
        const dbItem = itemMap.get(reqItem.stopItemId)!;
        const status = reqItem.confirmedQty === dbItem.plannedQty
          ? "accepted"
          : reqItem.confirmedQty > 0 ? "partial" : "rejected";

        const updatedItem = await tx.truckStopItem.update({
          where: { id: reqItem.stopItemId },
          data: {
            confirmedQty: reqItem.confirmedQty,
            status,
            rejectionNote: reqItem.rejectionNote,
            processedAt: new Date(),
          },
        });
        resItems.push(updatedItem);

        if (stop.stopType === "pickup" && reqItem.confirmedQty > 0) {
          // Deduct from SellerProduct
          const sp = await tx.sellerProduct.findFirst({
            where: { sellerId: stop.entityId, productCode: dbItem.productCode, stock: { gte: reqItem.confirmedQty } },
          });

          if (!sp) throw new Error(`Insufficient stock for \${dbItem.productCode}`);

          await tx.sellerProduct.update({
            where: { id: sp.id },
            data: { stock: { decrement: reqItem.confirmedQty } },
          });
        }

        // [Fix T4] Downstream Auto-Adjust
        if (stop.stopType === "pickup" && reqItem.confirmedQty < dbItem.plannedQty) {
          const shortage = dbItem.plannedQty - reqItem.confirmedQty;
          const futureDeliveryItems = await tx.truckStopItem.findMany({
            where: {
              productCode: dbItem.productCode,
              stop: {
                truckId: truckId,
                stopIndex: { gt: stop.stopIndex },
                stopType: "delivery",
              },
            },
            orderBy: { stop: { stopIndex: "desc" } }, // reduce from last delivery stop first
          });

          let remainingShortage = shortage;
          for (const fItem of futureDeliveryItems) {
            if (remainingShortage <= 0) break;
            const reduceBy = Math.min(fItem.plannedQty, remainingShortage);
            await tx.truckStopItem.update({
              where: { id: fItem.id },
              data: { plannedQty: fItem.plannedQty - reduceBy },
            });
            remainingShortage -= reduceBy;
          }
        }

        if (stop.stopType === "delivery" && reqItem.confirmedQty > 0) {
          // Delivery to Upazilla (since phase 1 and 2 deliver there mostly)
          // entityId is upazillaResellerId
          const ur = await tx.upazillaReseller.findUnique({ where: { id: stop.entityId } });
          if (!ur) throw new Error("Upazilla Reseller not found");

          // Upsert UpazillaStockItem
          let stockItem = await tx.upazillaStockItem.findFirst({
            where: { upazillaResellerId: ur.id, productName: dbItem.productName },
          });

          if (stockItem) {
            await tx.upazillaStockItem.update({
              where: { id: stockItem.id },
              data: { quantity: { increment: reqItem.confirmedQty } },
            });
          } else {
            await tx.upazillaStockItem.create({
              data: {
                upazillaResellerId: ur.id,
                productName: dbItem.productName,
                quantity: reqItem.confirmedQty,
              },
            });
          }

          // Update UpazillaDemand
          const demand = await tx.upazillaDemand.findFirst({
            where: { upazillaResellerId: ur.id, productName: dbItem.productName },
          });

          if (demand) {
            const newFulfilled = demand.fulfilledQuantity + reqItem.confirmedQty;
            const newStatus = newFulfilled >= demand.demandQuantity ? "fulfilled" : "partially_fulfilled";
            
            await tx.upazillaDemand.update({
              where: { id: demand.id },
              data: { fulfilledQuantity: newFulfilled, status: newStatus },
            });
          }
        }
      }

      const allItemsAccepted = resItems.every((i) => i.status === "accepted");
      
      const upStop = await tx.truckStop.update({
        where: { id: stopId },
        data: {
          confirmedAt: new Date(),
          status: "completed", // always completed
        },
      });

      const upTruck = await tx.truck.update({
        where: { id: truckId },
        data: { currentStopIndex: { increment: 1 } },
        include: { stops: { orderBy: { stopIndex: "asc" } } },
      });

      let nxStop = null;
      // [Fix T5] Leftover stock handling -> dynamic hub_deposit
      if (upTruck.currentStopIndex >= upTruck.stops.length) {
        // We reached the end. Let's check for leftover stock.
        const allStops = await tx.truckStop.findMany({
          where: { truckId },
          include: { items: true },
        });

        const truckAgg: Record<string, { loaded: number; delivered: number; name: string }> = {};
        allStops.forEach((s) => {
          s.items.forEach((item) => {
            if (!truckAgg[item.productCode]) truckAgg[item.productCode] = { loaded: 0, delivered: 0, name: item.productName };
            const qty = item.confirmedQty ?? 0;
            if (s.stopType === "pickup") truckAgg[item.productCode].loaded += qty;
            if (s.stopType === "delivery") truckAgg[item.productCode].delivered += qty;
          });
        });

        const leftoverItems = Object.entries(truckAgg)
          .map(([code, metrics]) => ({ productCode: code, productName: metrics.name, qty: metrics.loaded - metrics.delivered }))
          .filter((x) => x.qty > 0);

        const lastStopType = upTruck.stops[upTruck.stops.length - 1].stopType;

        if (leftoverItems.length > 0 && lastStopType !== "hub_deposit") {
          // Create a dynamic hub_deposit stop
          const hubStop = await tx.truckStop.create({
            data: {
              truckId,
              stopIndex: upTruck.stops.length,
              stopType: "hub_deposit",
              entityId: "SYSTEM_DISTRICT_HUB",
              entityType: "district_hub",
              entityName: "District Hub Auto-Deposit",
              lat: 23.685, // Default fallback
              lng: 90.356,
              district: "Dhaka",
              status: "pending",
              items: {
                create: leftoverItems.map(i => ({
                  productCode: i.productCode,
                  productName: i.productName,
                  action: "deposit",
                  plannedQty: i.qty,
                  status: "pending"
                }))
              }
            },
            include: { items: true }
          });
          
          upTruck.stops.push(hubStop);
          nxStop = hubStop;
        } else {
          await tx.truck.update({
            where: { id: truckId },
            data: { status: "completed", completedAt: new Date() },
          });
        }
      } else {
        nxStop = upTruck.stops.find((s) => s.stopIndex === upTruck.currentStopIndex);
      }

      return { updatedStop: upStop, updatedItems: resItems, nextStop: nxStop };
    });

    // RealtimeActions outside transaction
    const itemsSummary = updatedItems.map((i) => `\${i.productName}: \${i.confirmedQty}`).join(", ");
    const actionVerb = stop.stopType === "pickup" ? "gave" : "received";

    await createRealtimeAction({
      userId: stop.entityId,
      userRole: stop.entityType,
      actionType: "stop_confirmed",
      title: "Stop Confirmed",
      message: `Stop confirmed. You \${actionVerb}: \${itemsSummary}`,
      metadata: { stopId: stop.id },
      priority: "normal",
      requiresAction: false,
    });

    if (nextStop) {
      await createRealtimeAction({
        userId: nextStop.entityId,
        userRole: nextStop.entityType,
        actionType: "truck_arriving_soon",
        title: "Truck Heading Your Way",
        message: `Truck \${stop.truck.truckCode} is heading to you.`,
        metadata: { truckId: truckId, stopId: nextStop.id },
        priority: "urgent",
        requiresAction: true,
      });
    }

    return NextResponse.json({ stop: updatedStop, updatedItems, nextStop });
  } catch (error: any) {
    console.error("POST stop confirm error:", error);
    return NextResponse.json({ error: error.message || "Failed to confirm stop" }, { status: 500 });
  }
}
