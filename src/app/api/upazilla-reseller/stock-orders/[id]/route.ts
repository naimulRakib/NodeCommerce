import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const body = await req.json();
    const { action, agreedPrice } = body;

    const resolvedParams = await params;

    const order = await prisma.stockOrderNegotiation.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.upazillaResellerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (action === "accept_counter") {
      if (order.status !== "countered") {
        return NextResponse.json({ error: "Order is not in countered status" }, { status: 400 });
      }

      if (agreedPrice !== order.counterPrice) {
        return NextResponse.json({ error: "Agreed price must equal counter price" }, { status: 400 });
      }

      const updatedOrder = await prisma.stockOrderNegotiation.update({
        where: { id: resolvedParams.id },
        data: {
          status: "accepted",
          finalPrice: order.counterPrice
        }
      });

      return NextResponse.json(updatedOrder);

    } else if (action === "cancel") {
      if (order.status !== "pending" && order.status !== "countered") {
        return NextResponse.json({ error: "Cannot cancel an order that is already accepted or fulfilled" }, { status: 400 });
      }

      const updatedOrder = await prisma.stockOrderNegotiation.update({
        where: { id: resolvedParams.id },
        data: {
          status: "cancelled"
        }
      });

      return NextResponse.json(updatedOrder);

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Failed to update stock order:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
