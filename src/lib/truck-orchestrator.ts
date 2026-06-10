import { prisma } from "@/lib/prisma";
import { getUpazillaCoords, getDistrictCoords } from "@/lib/aco-distance";

export async function buildTruckPlans(jobId: string) {
  // 1. Fetch all pending shipments for this job
  const shipments = await prisma.aCOShipment.findMany({
    where: { jobId, status: { in: ["pending_approval", "dispatched", "pending"] } },
    include: { lineItems: true },
  });

  if (shipments.length === 0) return;

  // We group shipments by phase and destination
  // Phase 1: Seller -> Upazilla Hub
  const phase1Shipments = shipments.filter(s => s.phase === 1);
  await buildPhase1Trucks(jobId, phase1Shipments);

  // Phase 2: Seller Surplus -> District Hub
  const phase2Shipments = shipments.filter(s => s.phase === 2);
  await buildPhase2Trucks(jobId, phase2Shipments);

  // Phase 4: Dest District Hub -> Dest Upazillas
  const phase4Shipments = shipments.filter(s => s.phase === 4);
  await buildPhase4Trucks(jobId, phase4Shipments);

  // Phase 1b: Upazilla Hub -> Local Resellers
  // Note: ACO creates Phase 1 shipments to Upazillas. 
  // We don't have explicit ACO shipments to local resellers yet in the standard ACO run.
  // The local reseller distribution is governed by UpazillaDemand.
  // We can build Phase 1b trucks based on UpazillaDemand fulfillment.
  await buildPhase1bTrucks(jobId);
}

async function buildPhase1Trucks(jobId: string, shipments: any[]) {
  // Group by destination Upazilla Hub
  const byDest = new Map<string, any[]>();
  for (const s of shipments) {
    const key = s.toId;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push(s);
  }

  for (const [destId, group] of byDest) {
    const destName = group[0].toName;
    const destCoords = getUpazillaCoords(destName) || { lat: 23.7, lng: 90.4 };

    let currentTruck: any = null;
    let truckIndex = 1;
    let stopIndex = 1;

    for (const ship of group) {
      for (const item of ship.lineItems) {
        let remainingToLoad = item.allocatedQty;

        while (remainingToLoad > 0) {
          if (!currentTruck || currentTruck.loadedUnits >= currentTruck.capacityUnits) {
            // Finalize previous truck (add the dropoff stop)
            if (currentTruck) {
              await finalizeTruck(currentTruck, destId, "upazilla_reseller", destName, destCoords);
            }
            // Create new truck
            currentTruck = await createTruck(jobId);
            truckIndex++;
            stopIndex = 1;
          }

          const availableSpace = currentTruck.capacityUnits - currentTruck.loadedUnits;
          const loadNow = Math.min(remainingToLoad, availableSpace);

          // Add Pickup Stop for Seller
          const sellerCoords = await getSellerCoordinatesFromDb(ship.fromId);
          const stop = await prisma.truckStop.create({
            data: {
              truckId: currentTruck.id,
              stopIndex: stopIndex++,
              stopType: "pickup",
              entityId: ship.fromId,
              entityType: "seller",
              entityName: ship.fromName,
              lat: sellerCoords.lat,
              lng: sellerCoords.lng,
              district: "Dhaka", // Stub, should look up real
              acoShipmentId: ship.id,
              items: {
                create: {
                  productCode: item.productCode || "UNK",
                  productName: item.productName,
                  action: "pickup",
                  plannedQty: loadNow,
                }
              }
            }
          });

          // Send notification to Seller to Accept Pickup
          await prisma.realtimeAction.create({
            data: {
              actionType: "interactive_truck_pickup",
              userId: ship.fromId,
              userRole: "seller",
              title: `🚛 Truck T${currentTruck.truckNumber} is arriving to PICK UP stock!`,
              message: `Planned: ${loadNow} units. Your total stock: N/A. How much will you give?`,
              metadata: { stopId: stop.id, truckId: currentTruck.id, productCode: item.productCode, maxQty: loadNow }
            }
          });

          currentTruck.loadedUnits += loadNow;
          remainingToLoad -= loadNow;
        }
      }
    }

    if (currentTruck && currentTruck.loadedUnits > 0) {
      await finalizeTruck(currentTruck, destId, "upazilla_reseller", destName, destCoords);
    }
  }
}

async function buildPhase2Trucks(jobId: string, shipments: any[]) {
  // Seller Surplus -> District Hub
  const byDest = new Map<string, any[]>();
  for (const s of shipments) {
    const key = s.toId;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push(s);
  }

  for (const [destId, group] of byDest) {
    const destName = group[0].toName;
    const destCoords = getDistrictCoords(destName) || { lat: 23.7, lng: 90.4 };

    let currentTruck: any = null;
    let truckIndex = 1;
    let stopIndex = 1;

    for (const ship of group) {
      for (const item of ship.lineItems) {
        let remainingToLoad = item.allocatedQty;

        while (remainingToLoad > 0) {
          if (!currentTruck || currentTruck.loadedUnits >= currentTruck.capacityUnits) {
            if (currentTruck) {
              await finalizeTruck(currentTruck, destId, "district_reseller", destName, destCoords);
            }
            currentTruck = await createTruck(jobId);
            truckIndex++;
            stopIndex = 1;
          }

          const availableSpace = currentTruck.capacityUnits - currentTruck.loadedUnits;
          const loadNow = Math.min(remainingToLoad, availableSpace);

          const sellerCoords = await getSellerCoordinatesFromDb(ship.fromId);
          const stop = await prisma.truckStop.create({
            data: {
              truckId: currentTruck.id,
              stopIndex: stopIndex++,
              stopType: "pickup",
              entityId: ship.fromId,
              entityType: "seller",
              entityName: ship.fromName,
              lat: sellerCoords.lat,
              lng: sellerCoords.lng,
              district: "Dhaka",
              acoShipmentId: ship.id,
              items: {
                create: {
                  productCode: item.productCode || "UNK",
                  productName: item.productName,
                  action: "pickup",
                  plannedQty: loadNow,
                }
              }
            }
          });

          await prisma.realtimeAction.create({
            data: {
              actionType: "interactive_truck_pickup",
              userId: ship.fromId,
              userRole: "seller",
              title: `🚛 Truck T${currentTruck.truckNumber} arriving for SURPLUS PICKUP!`,
              message: `Planned: ${loadNow} units. Will you give this surplus?`,
              metadata: { stopId: stop.id, truckId: currentTruck.id, productCode: item.productCode, maxQty: loadNow }
            }
          });

          currentTruck.loadedUnits += loadNow;
          remainingToLoad -= loadNow;
        }
      }
    }

    if (currentTruck && currentTruck.loadedUnits > 0) {
      await finalizeTruck(currentTruck, destId, "district_reseller", destName, destCoords);
    }
  }
}

async function buildPhase4Trucks(jobId: string, shipments: any[]) {
  // District Hub -> Upazilla Hub
  const byDest = new Map<string, any[]>();
  for (const s of shipments) {
    const key = s.toId;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push(s);
  }

  for (const [destId, group] of byDest) {
    const destName = group[0].toName;
    const destCoords = getUpazillaCoords(destName) || { lat: 23.7, lng: 90.4 };

    let currentTruck: any = null;
    let truckIndex = 1;
    let stopIndex = 1;

    for (const ship of group) {
      for (const item of ship.lineItems) {
        let remainingToLoad = item.allocatedQty;

        while (remainingToLoad > 0) {
          if (!currentTruck || currentTruck.loadedUnits >= currentTruck.capacityUnits) {
            if (currentTruck) {
              await finalizeTruck(currentTruck, destId, "upazilla_reseller", destName, destCoords);
            }
            currentTruck = await createTruck(jobId);
            truckIndex++;
            stopIndex = 1;
          }

          const availableSpace = currentTruck.capacityUnits - currentTruck.loadedUnits;
          const loadNow = Math.min(remainingToLoad, availableSpace);

          const distCoords = getDistrictCoords(ship.fromName) || { lat: 23.7, lng: 90.4 };
          const stop = await prisma.truckStop.create({
            data: {
              truckId: currentTruck.id,
              stopIndex: stopIndex++,
              stopType: "pickup",
              entityId: ship.fromId,
              entityType: "district_reseller",
              entityName: ship.fromName,
              lat: distCoords.lat,
              lng: distCoords.lng,
              district: ship.fromName,
              acoShipmentId: ship.id,
              items: {
                create: {
                  productCode: item.productCode || "UNK",
                  productName: item.productName,
                  action: "pickup",
                  plannedQty: loadNow,
                }
              }
            }
          });

          await prisma.realtimeAction.create({
            data: {
              actionType: "interactive_truck_pickup",
              userId: ship.fromId,
              userRole: "district_reseller",
              title: `🚛 Truck T${currentTruck.truckNumber} loading for Upazilla transfer!`,
              message: `Planned: ${loadNow} units. Confirm load?`,
              metadata: { stopId: stop.id, truckId: currentTruck.id, productCode: item.productCode, maxQty: loadNow }
            }
          });

          currentTruck.loadedUnits += loadNow;
          remainingToLoad -= loadNow;
        }
      }
    }

    if (currentTruck && currentTruck.loadedUnits > 0) {
      await finalizeTruck(currentTruck, destId, "upazilla_reseller", destName, destCoords);
    }
  }
}

async function buildPhase1bTrucks(jobId: string) {
  // Phase 1b: Upazilla Hub -> Local Resellers
  // We simulate this by looking at all active UpazillaDemands and their local demands.
  const upazillaResellers = await prisma.upazillaReseller.findMany({
    include: { localResellers: true }
  });

  for (const ur of upazillaResellers) {
    if (ur.localResellers.length === 0) continue;

    // Generate a single truck for this Upazilla's local distribution
    const truck = await createTruck(jobId);
    let stopIndex = 1;
    let totalLoaded = 0;

    // Stop 1: Pickup at Upazilla Hub
    const urCoords = getUpazillaCoords(ur.upazilla) || { lat: 23.7, lng: 90.4 };
    const pickupStop = await prisma.truckStop.create({
      data: {
        truckId: truck.id,
        stopIndex: stopIndex++,
        stopType: "pickup",
        entityId: ur.id,
        entityType: "upazilla_reseller",
        entityName: ur.upazilla,
        lat: urCoords.lat,
        lng: urCoords.lng,
        district: ur.city,
      }
    });

    // Notify Upazilla Hub
    await prisma.realtimeAction.create({
      data: {
        actionType: "interactive_truck_pickup",
        userId: ur.id,
        userRole: "upazilla_reseller",
        title: `🚛 Local Delivery Truck T${truck.truckNumber} is ready for loading!`,
        message: `Truck is waiting to be loaded with local reseller stock.`,
        metadata: { stopId: pickupStop.id, truckId: truck.id, maxQty: 500 }
      }
    });

    // Subsequent Stops: Dropoff at Local Resellers
    for (const lr of ur.localResellers) {
      const lrCoords = { lat: lr.lat || urCoords.lat + 0.01, lng: lr.lng || urCoords.lng + 0.01 };
      // Simulate an average delivery of 50 units for demo purposes if no specific demand rows exist.
      const deliverNow = 50; 
      
      const dropStop = await prisma.truckStop.create({
        data: {
          truckId: truck.id,
          stopIndex: stopIndex++,
          stopType: "dropoff",
          entityId: lr.id,
          entityType: "local_reseller",
          entityName: lr.username,
          lat: lrCoords.lat,
          lng: lrCoords.lng,
          district: ur.city,
          upazilla: ur.upazilla,
        }
      });

      await prisma.realtimeAction.create({
        data: {
          actionType: "interactive_truck_dropoff",
          userId: lr.id,
          userRole: "local_reseller",
          title: `🚛 Truck T${truck.truckNumber} is arriving to DELIVER stock!`,
          message: `Planned: ${deliverNow} units. How much will you take?`,
          metadata: { stopId: dropStop.id, truckId: truck.id, maxQty: deliverNow }
        }
      });

      totalLoaded += deliverNow;
    }

    // Update truck with total loaded (up to capacity)
    await prisma.truck.update({
      where: { id: truck.id },
      data: { loadedUnits: Math.min(totalLoaded, 500), status: "dispatched" }
    });
  }
}

async function createTruck(jobId: string) {
  const truckCount = await prisma.truck.count();
  return await prisma.truck.create({
    data: {
      jobId,
      truckNumber: truckCount + 1,
      truckCode: `TRK-${jobId.substring(0,4)}-${truckCount + 1}`,
      capacityUnits: 500,
      loadedUnits: 0,
      status: "planning",
    }
  });
}

async function finalizeTruck(truck: any, destId: string, destType: string, destName: string, coords: {lat: number, lng: number}) {
  // Add the final dropoff stop
  const stopIndex = await prisma.truckStop.count({ where: { truckId: truck.id } }) + 1;
  const stop = await prisma.truckStop.create({
    data: {
      truckId: truck.id,
      stopIndex,
      stopType: "dropoff",
      entityId: destId,
      entityType: destType,
      entityName: destName,
      lat: coords.lat,
      lng: coords.lng,
      district: "Dhaka",
    }
  });
  
  await prisma.truck.update({
    where: { id: truck.id },
    data: { status: "dispatched" }
  });

  // Notify destination
  await prisma.realtimeAction.create({
    data: {
      actionType: "interactive_truck_dropoff",
      userId: destId,
      userRole: destType.split('_')[0],
      title: `🚛 Truck T${truck.truckNumber} is arriving to DELIVER stock!`,
      message: `Planned: ${truck.loadedUnits} units. How much will you accept?`,
      metadata: { stopId: stop.id, truckId: truck.id, maxQty: truck.loadedUnits }
    }
  });
}

async function getSellerCoordinatesFromDb(sellerId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { sellerId } });
  return { lat: seller?.lat || 23.7, lng: seller?.lng || 90.4 };
}
