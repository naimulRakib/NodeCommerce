import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRealtimeAction } from "@/lib/realtime-notifier";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const trucks = await prisma.truck.findMany({
      where: { jobId },
      include: {
        stops: {
          include: { items: true },
          orderBy: { stopIndex: "asc" },
        },
      },
      orderBy: { truckNumber: "asc" },
    });

    return NextResponse.json({ trucks });
  } catch (error: any) {
    console.error("GET trucks error:", error);
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const internalSecret = request.headers.get("X-Internal-Secret");
    // Verify against env in real app, e.g., process.env.INTERNAL_SECRET
    if (!internalSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, truckPlans } = body;

    if (!jobId || !Array.isArray(truckPlans)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let trucksCreated = 0;
    let stopsCreated = 0;

    for (const plan of truckPlans) {
      await prisma.$transaction(async (tx) => {
        const truck = await tx.truck.create({
          data: {
            jobId,
            truckNumber: plan.truckNumber,
            truckCode: plan.truckCode,
            capacityUnits: 500, // or pass from plan if available
            loadedUnits: 0,
            status: "planning",
          },
        });

        trucksCreated++;

        for (const stopPlan of plan.stops) {
          const stop = await tx.truckStop.create({
            data: {
              truckId: truck.id,
              stopIndex: stopPlan.stopIndex,
              stopType: stopPlan.stopType,
              entityId: stopPlan.entityId,
              entityType: stopPlan.entityType,
              entityName: stopPlan.entityName,
              lat: stopPlan.lat,
              lng: stopPlan.lng,
              district: stopPlan.district,
              status: "pending",
              // We could link acoShipmentId here if available in stopPlan
              items: {
                create: stopPlan.items.map((item: any) => ({
                  productCode: item.productCode,
                  productName: item.productName,
                  action: item.action,
                  plannedQty: item.plannedQty,
                  status: "pending",
                })),
              },
            },
          });

          stopsCreated++;

          // Realtime Notifications
          const itemsString = stopPlan.items
            .map((i: any) => `\${i.productName}: \${i.plannedQty}`)
            .join(", ");

          if (stopPlan.stopType === "pickup") {
            await createRealtimeAction({
              userId: stopPlan.entityId,
              userRole: stopPlan.entityType, // e.g., "seller"
              actionType: "truck_arriving",
              title: `Truck \${plan.truckCode} coming to pick up`,
              message: `Truck \${plan.truckCode} will arrive soon. Please prepare these items: \${itemsString}`,
              metadata: { truckId: truck.id, stopId: stop.id },
              priority: "urgent",
              requiresAction: true,
            });
          } else if (stopPlan.stopType === "delivery") {
            await createRealtimeAction({
              userId: stopPlan.entityId,
              userRole: stopPlan.entityType, // e.g., "upazilla_reseller"
              actionType: "truck_arriving",
              title: `Truck \${plan.truckCode} delivering to you`,
              message: `Truck \${plan.truckCode} will deliver: \${itemsString}. Estimated arrival soon.`,
              metadata: { truckId: truck.id, stopId: stop.id },
              priority: "urgent",
              requiresAction: true,
            });
          }
        }
      });
    }

    return NextResponse.json({ trucksCreated, stopsCreated });
  } catch (error: any) {
    console.error("POST trucks error:", error);
    return NextResponse.json({ error: error.message || "Failed to create trucks" }, { status: 500 });
  }
}
