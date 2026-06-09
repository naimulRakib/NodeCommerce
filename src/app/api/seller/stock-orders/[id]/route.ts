import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { action, counterPrice, sellerNote } = body;

    const resolvedParams = await params;

    const order = await prisma.stockOrderNegotiation.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.sellerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (order.status !== "pending") {
      return NextResponse.json({ error: "Order already responded to" }, { status: 400 });
    }

    let updateData: any = {};

    if (action === "accept") {
      updateData.status = "accepted";
      updateData.finalPrice = order.negotiatedPrice;
    } else if (action === "reject") {
      if (!sellerNote || sellerNote.trim() === "") {
        return NextResponse.json({ error: "Please provide a reason for rejection" }, { status: 400 });
      }
      updateData.status = "rejected";
      updateData.sellerNote = sellerNote;
    } else if (action === "counter") {
      if (typeof counterPrice !== "number" || counterPrice <= 0) {
        return NextResponse.json({ error: "Valid counter price is required" }, { status: 400 });
      }
      if (counterPrice > order.originalPrice || counterPrice < order.negotiatedPrice) {
        return NextResponse.json({ error: "Counter price must be between negotiated price and original price" }, { status: 400 });
      }
      updateData.status = "countered";
      updateData.counterPrice = counterPrice;
      if (sellerNote) {
        updateData.sellerNote = sellerNote;
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updatedOrder = await prisma.stockOrderNegotiation.update({
      where: { id: resolvedParams.id },
      data: updateData
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Failed to update stock order:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
