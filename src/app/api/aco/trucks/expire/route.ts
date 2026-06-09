import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRealtimeAction } from "@/lib/realtime-notifier";

export async function POST(request: Request) {
  try {
    // This is meant to be called by a cron job (e.g. every 5 minutes)
    // Find all stops that have been "truck_arrived" for > 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const expiredStops = await prisma.truckStop.findMany({
      where: {
        status: "truck_arrived",
        actualArrival: { lt: thirtyMinsAgo }
      },
      include: { items: true, truck: true }
    });

    if (expiredStops.length === 0) {
      return NextResponse.json({ message: "No expired stops found" });
    }

    const processedIds: string[] = [];

    for (const stop of expiredStops) {
      await prisma.$transaction(async (tx) => {
        const resItems = [];

        // Determine action based on stopType
        // Delivery: benefit reseller (full accept)
        // Pickup: cannot force (auto skip/0)
        for (const item of stop.items) {
          const autoQty = stop.stopType === "delivery" ? item.plannedQty : 0;
          const status = autoQty === item.plannedQty ? "accepted" : "rejected";

          const updatedItem = await tx.truckStopItem.update({
            where: { id: item.id },
            data: {
              confirmedQty: autoQty,
              status,
              rejectionNote: "Auto-processed due to network timeout",
              processedAt: new Date(),
            },
          });
          resItems.push(updatedItem);

          if (stop.stopType === "delivery" && autoQty > 0) {
            const ur = await tx.upazillaReseller.findUnique({ where: { id: stop.entityId } });
            if (ur) {
              // Upsert UpazillaStockItem
              let stockItem = await tx.upazillaStockItem.findFirst({
                where: { upazillaResellerId: ur.id, productName: item.productName },
              });

              if (stockItem) {
                await tx.upazillaStockItem.update({
                  where: { id: stockItem.id },
                  data: { quantity: { increment: autoQty } },
                });
              } else {
                await tx.upazillaStockItem.create({
                  data: {
                    upazillaResellerId: ur.id,
                    productName: item.productName,
                    quantity: autoQty,
                  },
                });
              }

              // Update UpazillaDemand
              const demand = await tx.upazillaDemand.findFirst({
                where: { upazillaResellerId: ur.id, productName: item.productName },
              });

              if (demand) {
                const newFulfilled = demand.fulfilledQuantity + autoQty;
                const newStatus = newFulfilled >= demand.demandQuantity ? "fulfilled" : "partially_fulfilled";
                
                await tx.upazillaDemand.update({
                  where: { id: demand.id },
                  data: { fulfilledQuantity: newFulfilled, status: newStatus },
                });
              }
            }
          }
          
          if (stop.stopType === "pickup" && autoQty < item.plannedQty) {
            // [Fix T4 logic reused] Shortage from pickup
            const shortage = item.plannedQty - autoQty;
            const futureDeliveryItems = await tx.truckStopItem.findMany({
              where: {
                productCode: item.productCode,
                stop: {
                  truckId: stop.truckId,
                  stopIndex: { gt: stop.stopIndex },
                  stopType: "delivery",
                },
              },
              orderBy: { stop: { stopIndex: "desc" } },
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
        }

        const upStop = await tx.truckStop.update({
          where: { id: stop.id },
          data: {
            confirmedAt: new Date(),
            status: "completed",
          },
        });

        const upTruck = await tx.truck.update({
          where: { id: stop.truckId },
          data: { currentStopIndex: { increment: 1 } },
          include: { stops: { orderBy: { stopIndex: "asc" } } },
        });

        let nxStop = null;
        if (upTruck.currentStopIndex >= upTruck.stops.length) {
          // [Fix T5 logic reused] Leftover stock handling -> dynamic hub_deposit
          const allStops = await tx.truckStop.findMany({
            where: { truckId: stop.truckId },
            include: { items: true },
          });

          const truckAgg: Record<string, { loaded: number; delivered: number; name: string }> = {};
          allStops.forEach((s) => {
            s.items.forEach((i) => {
              if (!truckAgg[i.productCode]) truckAgg[i.productCode] = { loaded: 0, delivered: 0, name: i.productName };
              const qty = i.confirmedQty ?? 0;
              if (s.stopType === "pickup") truckAgg[i.productCode].loaded += qty;
              if (s.stopType === "delivery") truckAgg[i.productCode].delivered += qty;
            });
          });

          const leftoverItems = Object.entries(truckAgg)
            .map(([code, metrics]) => ({ productCode: code, productName: metrics.name, qty: metrics.loaded - metrics.delivered }))
            .filter((x) => x.qty > 0);

          const lastStopType = upTruck.stops[upTruck.stops.length - 1].stopType;

          if (leftoverItems.length > 0 && lastStopType !== "hub_deposit") {
            const hubStop = await tx.truckStop.create({
              data: {
                truckId: stop.truckId,
                stopIndex: upTruck.stops.length,
                stopType: "hub_deposit",
                entityId: "SYSTEM_DISTRICT_HUB",
                entityType: "district_hub",
                entityName: "District Hub Auto-Deposit",
                lat: 23.685,
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
            nxStop = hubStop;
          } else {
            await tx.truck.update({
              where: { id: stop.truckId },
              data: { status: "completed", completedAt: new Date() },
            });
          }
        } else {
          nxStop = upTruck.stops.find((s) => s.stopIndex === upTruck.currentStopIndex);
        }

        // Notify user of auto-action
        await createRealtimeAction({
          userId: stop.entityId,
          userRole: stop.entityType,
          actionType: "stop_auto_confirmed",
          title: "Timeout: Stop Auto-Confirmed",
          message: `You didn't respond in time. Stop automatically processed.`,
          metadata: { stopId: stop.id },
          priority: "info",
          requiresAction: false,
        });

        if (nxStop) {
          await createRealtimeAction({
            userId: nxStop.entityId,
            userRole: nxStop.entityType,
            actionType: "truck_arriving_soon",
            title: "Truck Heading Your Way",
            message: `Truck \${stop.truck.truckCode} is heading to you.`,
            metadata: { truckId: stop.truckId, stopId: nxStop.id },
            priority: "urgent",
            requiresAction: true,
          });
        }
      });
      processedIds.push(stop.id);
    }

    return NextResponse.json({ message: `Processed \${processedIds.length} expired stops`, processedIds });
  } catch (error: any) {
    console.error("POST expire trucks error:", error);
    return NextResponse.json({ error: error.message || "Failed to process timeouts" }, { status: 500 });
  }
}
