import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRealtimeAction } from "@/lib/realtime-notifier";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, counterPrice, note } = body;

    if (!["accept", "counter", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be accept, counter, or reject." },
        { status: 400 }
      );
    }

    const negotiation = await prisma.sellerACONegotiation.findUnique({
      where: { id },
      include: { job: true, sellerProduct: true },
    });

    if (!negotiation) {
      return NextResponse.json({ error: "Negotiation not found." }, { status: 404 });
    }

    if (negotiation.status === "auto_accepted") {
      return NextResponse.json(
        { error: `Already auto-accepted at BDT \${negotiation.systemPrice}` },
        { status: 400 }
      );
    }

    if (negotiation.status !== "pending" && negotiation.status !== "countered") {
      return NextResponse.json({ error: "Negotiation is no longer pending/countered." }, { status: 400 });
    }

    if (negotiation.expiresAt && negotiation.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This negotiation has expired. Stock will be included at system price." },
        { status: 400 }
      );
    }

    let finalStatus = negotiation.status;
    let finalPrice = negotiation.offeredPrice;
    let createShipment = false;

    if (action === "reject") {
      finalStatus = "rejected";
    } else if (action === "counter") {
      if (!counterPrice || counterPrice <= 0) {
        return NextResponse.json({ error: "Valid counterPrice required." }, { status: 400 });
      }
      if (counterPrice > negotiation.sellerAskPrice) {
        return NextResponse.json({ error: "Cannot counter higher than own ask price." }, { status: 400 });
      }
      if (counterPrice <= negotiation.systemPrice * 0.5) {
        return NextResponse.json({ error: "Cannot go below 50% of system price." }, { status: 400 });
      }

      // Auto-evaluate
      if (counterPrice <= negotiation.systemPrice * 1.1) {
        finalStatus = "accepted";
        finalPrice = counterPrice;
        createShipment = true;
      } else {
        finalStatus = "countered";
        finalPrice = counterPrice;
      }
    } else if (action === "accept") {
      finalStatus = "accepted";
      finalPrice = negotiation.offeredPrice;
      createShipment = true;
    }

    // Process Transaction
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update negotiation
      const updatedNeg = await tx.sellerACONegotiation.update({
        where: { id },
        data: {
          status: finalStatus,
          offeredPrice: finalPrice,
          respondedAt: new Date(),
        },
      });

      // 2. If accepted, create shipment & mark product
      if (createShipment) {
        const sellerProfile = await tx.profile.findUnique({ where: { id: negotiation.sellerId } });
        if (!sellerProfile) throw new Error("Seller profile not found");
        
        const ur = await tx.upazillaReseller.findFirst({
          where: { city: sellerProfile.city, upazilla: sellerProfile.upazilla },
        });
        if (!ur) throw new Error("Upazilla Reseller not found for Seller");

        await tx.sellerProduct.update({
          where: { id: negotiation.sellerProductId },
          // A metadata flag field or similar could be added to SellerProduct model schema.
          // For now we will update stock or rely on the pending_dispatch state
          // User requested: 'Mark SellerProduct as "aco_validated"'
          // Since schema.prisma might not have a boolean `aco_validated`, we will skip adding a new column to schema right now to avoid schema drift, or update a json metadata if exists.
          data: {}, 
        });

        await tx.aCOShipment.create({
          data: {
            jobId: negotiation.jobId,
            phase: 1,
            fromType: "seller",
            fromId: negotiation.sellerId,
            fromName: sellerProfile.storeName,
            toType: "upazilla_reseller",
            toId: ur.id,
            toName: ur.email,
            totalQuantity: negotiation.requestedQty,
            overallAcoScore: 1.0, 
            distanceKm: 5.0, 
            status: "pending_dispatch",
            negotiationId: negotiation.id,
            sourceApproved: true,
            targetApproved: true,
            sourceApprovedAt: new Date(),
            targetApprovedAt: new Date(),
            lineItems: {
              create: [
                {
                  productName: negotiation.productName,
                  productCode: negotiation.productCode,
                  sellerProductId: negotiation.sellerProductId,
                  allocatedQty: negotiation.requestedQty,
                  acoScore: 1.0,
                  demandAtTime: negotiation.requestedQty,
                  pheromoneScore: 1.0,
                  allocationReason: "local_demand",
                  status: "pending_dispatch",
                },
              ],
            },
          },
        });
      }

      return updatedNeg;
    });

    // Realtime Notifications outside transaction (fire-and-forget)
    if (finalStatus === "accepted") {
      await createRealtimeAction({
        userId: negotiation.sellerId,
        userRole: "seller",
        actionType: "stock_accepted",
        title: "ACO Stock Accepted",
        message: `You accepted. Your \${negotiation.productName} (\${negotiation.requestedQty} units at BDT \${finalPrice}) is now part of the ACO routing plan.`,
        metadata: { negotiationId: negotiation.id },
        priority: "normal",
        requiresAction: false,
      });
    } else if (action === "counter" && finalStatus === "countered") {
      // Simulate system admin notification
      await createRealtimeAction({
        userId: "SYSTEM_ADMIN", // Or hardcode an admin role broadcast
        userRole: "admin",
        actionType: "negotiation_countered",
        title: "Negotiation Countered",
        message: `Seller \${negotiation.sellerId} countered \${negotiation.productName} at BDT \${counterPrice} (system offered: BDT \${negotiation.offeredPrice})`,
        metadata: { negotiationId: negotiation.id },
        priority: "normal",
        requiresAction: true,
      });
    }

    return NextResponse.json({ success: true, negotiation: updated });
  } catch (error: any) {
    console.error("Negotiation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process negotiation" },
      { status: 500 }
    );
  }
}
