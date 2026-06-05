import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  const { hasRole, error: roleError } = await requireRole(user.id, "seller");
  if (roleError) return roleError;

  const [orders, inventory, pendingCount] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId: user.id },
      select: { totalAmount: true, status: true },
    }),
    prisma.sellerProduct.count({
      where: { sellerId: user.id },
    }),
    prisma.order.count({
      where: { sellerId: user.id, status: "pending" },
    }),
  ]);

  const totalRevenue = orders
    .filter(o => o.status === "delivered")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalOrders = orders.length;

  return NextResponse.json({ totalRevenue, totalOrders, pendingCount, inventory });
}
