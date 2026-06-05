import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { trackBehaviour } from "@/lib/behaviour";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const cartItem = await prisma.cartItem.findUnique({
        where: { id: params.id },
        include: { sellerProduct: true }
    });

    if (!cartItem || cartItem.buyerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { quantity } = body;

    if (quantity === 0) {
        await prisma.cartItem.delete({ where: { id: params.id } });
        trackBehaviour(user.id, "remove_from_cart", { sellerProductId: cartItem.sellerProductId });
        return NextResponse.json({ success: true });
    }

    if (quantity > cartItem.sellerProduct.stock) {
        return NextResponse.json({ error: "Not enough stock" }, { status: 400 });
    }

    const updated = await prisma.cartItem.update({
        where: { id: params.id },
        data: { quantity }
    });

    return NextResponse.json({ cartItem: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const cartItem = await prisma.cartItem.findUnique({
        where: { id: params.id }
    });

    if (!cartItem || cartItem.buyerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.cartItem.delete({ where: { id: params.id } });
    trackBehaviour(user.id, "remove_from_cart", { sellerProductId: cartItem.sellerProductId });

    return NextResponse.json({ success: true });
}
