import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { sellerId: user.id };
    if (status && status !== "All") {
        where.status = status.toLowerCase();
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            items: {
                include: {
                    sellerProduct: { include: { globalProduct: true } }
                }
            },
            buyer: {
                select: { fullName: true, phone: true, email: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ orders });
}
