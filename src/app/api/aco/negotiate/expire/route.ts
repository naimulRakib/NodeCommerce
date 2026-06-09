import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRealtimeAction } from "@/lib/realtime-notifier";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || request.headers.get("x-cron-secret");
    
    // In a real app, verify against process.env.CRON_SECRET
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expiredNegotiations = await prisma.sellerACONegotiation.findMany({
      where: {
        status: "pending",
        expiresAt: { lt: new Date() },
      },
    });

    if (expiredNegotiations.length === 0) {
      return NextResponse.json({ autoAccepted: 0 });
    }

    let successCount = 0;

    for (const neg of expiredNegotiations) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Update status
          await tx.sellerACONegotiation.update({
            where: { id: neg.id },
            data: {
              status: "auto_accepted",
              offeredPrice: neg.systemPrice,
              respondedAt: new Date(),
            },
          });

          // 2. Create Shipment
          const sellerProfile = await tx.profile.findUnique({ where: { id: neg.sellerId } });
          if (!sellerProfile) throw new Error("Seller profile not found");
          
          const ur = await tx.upazillaReseller.findFirst({
            where: { city: sellerProfile.city, upazilla: sellerProfile.upazilla },
          });
          if (!ur) throw new Error("Upazilla Reseller not found for Seller");

          await tx.aCOShipment.create({
            data: {
              jobId: neg.jobId,
              phase: 1,
              fromType: "seller",
              fromId: neg.sellerId,
              fromName: sellerProfile.storeName,
              toType: "upazilla_reseller",
              toId: ur.id,
              toName: ur.email,
              totalQuantity: neg.requestedQty,
              overallAcoScore: 1.0, 
              distanceKm: 5.0, 
              status: "pending_dispatch",
              negotiationId: neg.id,
              sourceApproved: true,
              targetApproved: true,
              sourceApprovedAt: new Date(),
              targetApprovedAt: new Date(),
              lineItems: {
                create: [
                  {
                    productName: neg.productName,
                    productCode: neg.productCode,
                    sellerProductId: neg.sellerProductId,
                    allocatedQty: neg.requestedQty,
                    acoScore: 1.0,
                    demandAtTime: neg.requestedQty,
                    pheromoneScore: 1.0,
                    allocationReason: "local_demand",
                    status: "pending_dispatch",
                  },
                ],
              },
            },
          });
        });

        // 3. Send Notification (fire-and-forget outside transaction)
        await createRealtimeAction({
          userId: neg.sellerId,
          userRole: "seller",
          actionType: "stock_auto_accepted",
          title: "Auto-accepted by System",
          message: `You did not respond within 6 hours. Your \${neg.productName} (\${neg.requestedQty} units) has been included in ACO at BDT \${neg.systemPrice} per unit.`,
          metadata: { negotiationId: neg.id },
          priority: "info",
          requiresAction: false,
        });

        successCount++;
      } catch (err) {
        console.error(`Failed to process expiration for \${neg.id}`, err);
      }
    }

    return NextResponse.json({ autoAccepted: successCount });
  } catch (error: any) {
    console.error("Auto-expire error:", error);
    return NextResponse.json({ error: "Failed to process auto-expire" }, { status: 500 });
  }
}
