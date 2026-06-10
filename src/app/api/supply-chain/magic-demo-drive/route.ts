import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Find all trucks that are not completed or failed
    const activeTrucks = await prisma.truck.findMany({
      where: { status: { in: ["pending", "in_transit"] } },
      include: { stops: { include: { items: true } } },
      orderBy: { createdAt: "asc" }
    });

    let trucksMoved = 0;

    for (const truck of activeTrucks) {
      if (truck.currentStopIndex >= truck.stops.length) {
        // Truck finished
        if (truck.status !== "completed") {
          await prisma.truck.update({ where: { id: truck.id }, data: { status: "completed" } });
        }
        continue;
      }

      // Find the current stop
      // currentStopIndex is 1-based (or is it 0-based in truck-orchestrator?)
      // Let's check: in truck-orchestrator.ts: stopIndex: sIdx
      const currentStop = truck.stops.find(s => s.stopIndex === truck.currentStopIndex);
      if (!currentStop) continue;

      if (currentStop.status === "completed") {
        // Just advance the index if it's already completed somehow
        await prisma.truck.update({
          where: { id: truck.id },
          data: { currentStopIndex: { increment: 1 } }
        });
        continue;
      }

      // If status is pending, auto-accept!
      if (currentStop.status === "pending") {
        await prisma.$transaction(async (tx) => {
          const item = currentStop.items[0];
          const confirmedQty = item?.plannedQty || 0;

          // 1. Complete Stop
          await tx.truckStop.update({
            where: { id: currentStop.id },
            data: { status: "completed", confirmedAt: new Date() }
          });

          if (item) {
            await tx.truckStopItem.update({
              where: { id: item.id },
              data: { status: "completed", confirmedQty, processedAt: new Date() }
            });

            // Adjust Truck Loaded Units
            const qtyMod = currentStop.stopType === "pickup" ? confirmedQty : -confirmedQty;
            await tx.truck.update({
              where: { id: truck.id },
              data: { 
                loadedUnits: { increment: qtyMod },
                currentStopIndex: { increment: 1 },
                status: "in_transit"
              }
            });

            // Auto-transfer stock logic (simulating the backend triggers)
            if (currentStop.stopType === "dropoff" && currentStop.entityType === "district") {
              const existingStock = await tx.districtStockItem.findFirst({
                where: { districtResellerId: currentStop.entityId, productName: item.productName }
              });

              if (existingStock) {
                await tx.districtStockItem.update({
                  where: { id: existingStock.id },
                  data: { quantity: { increment: confirmedQty } }
                });
              } else {
                await tx.districtStockItem.create({
                  data: {
                    districtResellerId: currentStop.entityId,
                    productName: item.productName,
                    quantity: confirmedQty
                  }
                });
              }
            } else if (currentStop.stopType === "dropoff" && currentStop.entityType === "upazilla") {
              const existing = await tx.upazillaStockItem.findFirst({
                where: { upazillaResellerId: currentStop.entityId, productName: item.productName }
              });
              if (existing) {
                await tx.upazillaStockItem.update({ where: { id: existing.id }, data: { quantity: { increment: confirmedQty } } });
              } else {
                await tx.upazillaStockItem.create({
                  data: { upazillaResellerId: currentStop.entityId, productName: item.productName, quantity: confirmedQty }
                });
              }
            } else if (currentStop.stopType === "dropoff" && currentStop.entityType === "local_reseller") {
              const existing = await tx.resellerStockItem.findFirst({
                where: { resellerId: currentStop.entityId, customName: item.productName }
              });
              if (existing) {
                await tx.resellerStockItem.update({ where: { id: existing.id }, data: { quantity: { increment: confirmedQty } } });
              } else {
                await tx.resellerStockItem.create({
                  data: { resellerId: currentStop.entityId, customName: item.productName, quantity: confirmedQty }
                });
              }
            }
          }
        });
        trucksMoved++;
      }
    }

    // 2. Auto-approve any phase 3 shipments that are ready
    // We can do this in the same step so the frontend just polls one URL
    const pendingPhase3 = await prisma.aCOShipment.findMany({
      where: { phase: 3, status: "pending_approval" },
      include: { lineItems: true }
    });

    let shipmentsApproved = 0;

    for (const opp of pendingPhase3) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const item of opp.lineItems) {
            const stockItem = await tx.districtStockItem.findFirst({
              where: {
                districtResellerId: opp.fromId,
                productName: { equals: item.productName, mode: "insensitive" },
              },
            });

            if (!stockItem || stockItem.quantity < item.allocatedQty) {
               throw new Error("failed_insufficient");
            }

            await tx.districtStockItem.update({
              where: { id: stockItem.id },
              data: { quantity: { decrement: item.allocatedQty } },
            });

            await tx.nationalTransfer.create({
              data: {
                fromDistrictResellerId: opp.fromId,
                toDistrictResellerId: opp.toId,
                stockItemId: stockItem.id,
                productName: item.productName,
                quantity: item.allocatedQty,
                status: "pending",
              },
            });
          }

          // Update shipment to dispatched
          await tx.aCOShipment.update({
            where: { id: opp.id },
            data: { 
              status: "dispatched", 
              sourceApproved: true, 
              targetApproved: true,
              dispatchedAt: new Date()
            },
          });
          
          shipmentsApproved++;
        });
      } catch (e: any) {
        // If it throws failed_insufficient, we just ignore and try again next tick!
        // Because the physical truck might still be en route!
      }
    }

    return NextResponse.json({ 
      success: true, 
      trucksMoved, 
      shipmentsApproved,
      activeTrucksRemaining: activeTrucks.length
    });

  } catch (err: any) {
    console.error("Magic Drive Error:", err);
    return NextResponse.json({ error: "Failed to drive trucks" }, { status: 500 });
  }
}
