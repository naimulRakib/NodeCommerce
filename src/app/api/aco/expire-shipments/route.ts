import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Note: In production this would require a secret cron key.
    // For now we allow POST to run the expiry sweep.

    const now = new Date();

    const expiredShipments = await prisma.aCOShipment.findMany({
      where: {
        phase: 3,
        status: "pending_approval",
        expiresAt: { lt: now },
      },
      include: {
        lineItems: true,
      },
    });

    if (expiredShipments.length === 0) {
      return NextResponse.json({ ok: true, expiredCount: 0 });
    }

    let expiredCount = 0;
    const penalizedPheromones = new Set<string>();

    for (const ship of expiredShipments) {
      // Mark as expired
      await prisma.$transaction(async (tx) => {
        await tx.aCOShipment.update({
          where: { id: ship.id },
          data: {
            status: "expired",
            failureReason: "Expired before both parties approved.",
          },
        });

        await tx.aCOShipmentItem.updateMany({
          where: { shipmentId: ship.id },
          data: { status: "cancelled" },
        });

        // Penalize the destination's pheromones to force ACO to re-prioritize it.
        // It's the target district that suffered from this failed shipment.
        for (const li of ship.lineItems) {
          const pheromoneKey = `${li.productName.toLowerCase()}::${ship.toId}`;
          if (!penalizedPheromones.has(pheromoneKey)) {
            const pheromoneRow = await tx.demandPheromone.findFirst({
              where: {
                entityId: ship.toId,
                entityType: "district",
                productName: { equals: li.productName, mode: "insensitive" },
              },
            });
            if (pheromoneRow) {
              await tx.demandPheromone.update({
                where: { id: pheromoneRow.id },
                data: { waitingDays: { increment: 1 } },
              });
            }
            penalizedPheromones.add(pheromoneKey);
          }
        }
      });
      expiredCount++;
    }

    return NextResponse.json({
      ok: true,
      expiredCount,
      message: `Successfully expired ${expiredCount} shipments.`,
    });
  } catch (error: any) {
    console.error("Error expiring shipments:", error);
    return NextResponse.json(
      { error: "internal_error", details: error.message },
      { status: 500 }
    );
  }
}
