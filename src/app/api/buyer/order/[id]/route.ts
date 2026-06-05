import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const BUYER_CANCELLABLE_STATUSES = ["pending", "confirmed"];

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


  const orderId = params.id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.buyerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!BUYER_CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot cancel an order with status "${order.status}". Only pending or confirmed orders can be cancelled.` },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });

    for (const item of order.items) {
      await tx.sellerProduct.update({
        where: { id: item.sellerProductId },
        data: { stock: { increment: item.quantity } },
      });
    }


  });

  return NextResponse.json({ success: true });
}
