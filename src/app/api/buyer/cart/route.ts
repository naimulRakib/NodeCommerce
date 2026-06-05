import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { trackBehaviour } from "@/lib/behaviour";

export async function GET(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const items = await prisma.cartItem.findMany({
        where: { buyerId: user.id },
        include: {
            sellerProduct: {
                include: {
                    globalProduct: true,
                    seller: {
                        select: { storeName: true, city: true, sellerCode: true }
                    }
                }
            }
        },
        orderBy: { addedAt: "desc" }
    });

    return NextResponse.json({ items });
}

export async function POST(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const body = await req.json();
    const { sellerProductId, quantity = 1 } = body;

    const sellerProduct = await prisma.sellerProduct.findUnique({
        where: { id: sellerProductId }
    });

    if (!sellerProduct) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (sellerProduct.stock < quantity) {
        return NextResponse.json({ error: "Not enough stock available" }, { status: 400 });
    }

    try {
        // Ensure BuyerProfile exists to prevent FK constraint error
        const buyerExists = await prisma.buyerProfile.findUnique({ where: { id: user.id } });
        if (!buyerExists) {
            await prisma.buyerProfile.create({
                data: {
                    id: user.id,
                    email: user.email || `${user.id}@placeholder.com`,
                    fullName: "Shopper",
                }
            });
        }

        const existing = await prisma.cartItem.findFirst({
            where: { buyerId: user.id, sellerProductId }
        });

        let cartItem;
        if (existing) {
            if (sellerProduct.stock < existing.quantity + quantity) {
                return NextResponse.json({ error: "Not enough stock available" }, { status: 400 });
            }
            cartItem = await prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + quantity }
            });
        } else {
            cartItem = await prisma.cartItem.create({
                data: {
                    buyerId: user.id,
                    sellerProductId,
                    quantity
                }
            });
        }

        trackBehaviour(user.id, "add_to_cart", { sellerProductId, quantity });

        return NextResponse.json({ cartItem });
    } catch (e: any) {
        console.error("Add to cart error:", e);
        return NextResponse.json({ error: "Server error while adding to cart" }, { status: 500 });
    }
}
