import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: any = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: []
};

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const { user, error: authError } = await requireAuth();
        if (authError) return authError;
        const { hasRole, error: roleError } = await requireRole(user.id, "seller");
        if (roleError) return roleError;

        const orderId = params.id;
        const body = await req.json();
        const { status, note } = body;

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order || order.sellerId !== user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (!VALID_TRANSITIONS[order.status]?.includes(status)) {
            return NextResponse.json({ 
                error: `Invalid transition from ${order.status} to ${status}. Valid next statuses: ${VALID_TRANSITIONS[order.status].join(", ")}` 
            }, { status: 400 });
        }

        if (status === "cancelled" && !note) {
            return NextResponse.json({ error: "Cancellation note is required" }, { status: 400 });
        }

        await prisma.$transaction(async (tx: any) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status }
            });


            if (status === "cancelled") {
                for (const item of order.items) {
                    await tx.sellerProduct.update({
                        where: { id: item.sellerProductId },
                        data: { stock: { increment: item.quantity } }
                    });
                }
            }
        });

        const updated = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, buyer: true }
        });

        return NextResponse.json({ order: updated });
    } catch (e: any) {
        console.error("Order PATCH error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
