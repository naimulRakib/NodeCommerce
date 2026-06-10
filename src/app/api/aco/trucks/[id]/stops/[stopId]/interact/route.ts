import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(
  req: Request,
  { params }: { params: { id: string; stopId: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, acceptedQty, notificationId } = await req.json();
    // action: "accept" | "partial" | "reject"

    const stop = await prisma.truckStop.findUnique({
      where: { id: params.stopId },
      include: { items: true, truck: true }
    });

    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }

    if (stop.status !== "pending") {
      return NextResponse.json({ error: "Stop already processed" }, { status: 400 });
    }

    const item = stop.items[0]; // Assuming 1 product per stop for simple interactive flow

    // Calculate qty
    let confirmedQty = 0;
    if (action === "accept") confirmedQty = item?.plannedQty || 0;
    else if (action === "partial") confirmedQty = Number(acceptedQty) || 0;

    await prisma.$transaction(async (tx) => {
      // 1. Update Stop and Item
      await tx.truckStop.update({
        where: { id: stop.id },
        data: { 
          status: action === "reject" ? "rejected" : "completed",
          confirmedAt: new Date()
        }
      });

      if (item) {
        await tx.truckStopItem.update({
          where: { id: item.id },
          data: {
            status: action === "reject" ? "rejected" : "completed",
            confirmedQty,
            processedAt: new Date()
          }
        });

        // 2. Adjust Truck Loaded Units
        if (action !== "reject") {
          const qtyMod = stop.stopType === "pickup" ? confirmedQty : -confirmedQty;
          await tx.truck.update({
            where: { id: stop.truckId },
            data: { loadedUnits: { increment: qtyMod } }
          });
        }
      }

      // 3. Move truck to next stop (if current stop is this one)
      if (stop.truck.currentStopIndex === stop.stopIndex) {
        // Wait, currentStopIndex is 1-based usually, matching stopIndex
        await tx.truck.update({
          where: { id: stop.truckId },
          data: { currentStopIndex: { increment: 1 } }
        });
      }

      // 4. Mark notification as read
      if (notificationId) {
        await tx.realtimeAction.update({
          where: { id: notificationId },
          data: { isRead: true }
        });
      }
    });

    return NextResponse.json({ success: true, confirmedQty });
  } catch (err: any) {
    console.error("Truck Interact Error:", err);
    return NextResponse.json({ error: "Failed to process interaction" }, { status: 500 });
  }
}
