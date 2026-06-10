import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Simulate email monitor scraping the inbox for "TRUCK DOWN" emails
    const emails = await prisma.mockNotificationLog.findMany({
      where: {
        type: "email_inbox",
        subject: { contains: "TRUCK DOWN" },
        createdAt: { gte: new Date(Date.now() - 5 * 60000) } // Last 5 mins
      }
    });

    let processed = 0;

    for (const email of emails) {
      // Parse email content: "TRUCK DOWN #AUTO-TEST-1234" in subject and "SHIPMENT: SHP-AUTO-008" in body
      const matchSubj = email.subject?.match(/TRUCK DOWN #([A-Z0-9-]+)/);
      const matchBody = email.body.match(/SHIPMENT: ([A-Z0-9-]+)/);
      if (matchSubj && matchBody) {
        const truckId = matchSubj[1];
        const shipmentId = matchBody[1];

        // Fail the original shipment
        const oldShipment = await prisma.aCOShipment.findUnique({ where: { id: shipmentId } });
        if (!oldShipment) continue;

        await prisma.aCOShipment.update({
          where: { id: shipmentId },
          data: { status: "failed", failureReason: "truck_breakdown" }
        });

        // Trigger ACO Global Trigger (simulated locally)
        // Usually we would fetch to /api/aco/global-trigger, but we can simulate it directly in DB
        
        // Create new replacement shipment
        await prisma.aCOShipment.create({
          data: {
            jobId: oldShipment.jobId,
            phase: oldShipment.phase,
            status: "pending_negotiation", // Per test requirement
            fromType: oldShipment.fromType,
            fromId: oldShipment.fromId,
            fromName: oldShipment.fromName,
            toType: oldShipment.toType,
            toId: oldShipment.toId,
            toName: oldShipment.toName,
            totalQuantity: oldShipment.totalQuantity,
            overallAcoScore: oldShipment.overallAcoScore,
            distanceKm: oldShipment.distanceKm,
            notes: `Replacement for failed shipment ${shipmentId} due to truck breakdown (${truckId})`
          }
        });

        // Send alert
        await prisma.mockNotificationLog.create({
          data: {
            type: "email",
            recipient: "ops@nodecommerce.test",
            shipmentId,
            subject: `SELF-HEALING TRIGGERED for ${shipmentId}. Truck ${truckId} down.`,
            body: `SELF-HEALING TRIGGERED`
          }
        });

        processed++;
      }
    }

    return NextResponse.json({ success: true, processed });

  } catch (error: any) {
    console.error("[Email Monitor] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
