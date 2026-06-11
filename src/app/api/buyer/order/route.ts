import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { trackBehaviour } from "@/lib/behaviour";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        const { user, error: authError } = await requireAuth();
        if (authError) return authError;
        const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
        if (roleError) return roleError;

        // Rate Limit: 5 orders per minute per user
        const { success } = await rateLimit(`order:${user.id}`, 5, 60 * 1000);
        if (!success) {
            return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
        }

    const buyerId = user.id;
    const body = await req.json();
    const { buyerNote, paymentMethod } = body; // Payment method: "COD" or "WALLET"

    // 1. Fetch Cart
    const cartItems = await prisma.cartItem.findMany({
        where: { buyerId },
        include: {
            sellerProduct: { include: { globalProduct: true } }
        }
    });

    if (cartItems.length === 0) {
        return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // 2. Validate Stock
    const outOfStock = cartItems.filter(item => item.sellerProduct.stock < item.quantity);
    if (outOfStock.length > 0) {
        return NextResponse.json({ 
            error: "Some items are out of stock", 
            unavailable: outOfStock.map(i => i.id) 
        }, { status: 400 });
    }

    // 3. Fetch Buyer Profile for Address
    const buyer = await prisma.buyerProfile.findUnique({ where: { id: buyerId } });
    if (!buyer || !buyer.district || !buyer.city || !buyer.upazilla) {
        return NextResponse.json({ error: "Complete your delivery profile first" }, { status: 400 });
    }

    // 4. Group by Seller
    const groupedBySeller: Record<string, any[]> = {};
    for (const item of cartItems) {
        const sId = item.sellerProduct.sellerId;
        if (!groupedBySeller[sId]) groupedBySeller[sId] = [];
        groupedBySeller[sId].push(item);
    }

    const createdOrders = [];
    let totalItemsCount = 0;
    let grandTotalAmount = 0;

    // 5. Transaction: Create Orders, Decrement Stock, Notify, Clear Cart
    await prisma.$transaction(async (tx: any) => {
        for (const [sellerId, items] of Object.entries(groupedBySeller)) {
            const totalAmount = items.reduce((sum, item) => sum + (item.sellerProduct.price * item.quantity), 0);
            totalItemsCount += items.length;
            grandTotalAmount += totalAmount;

            // Create Order
            const order = await tx.order.create({
                data: {
                    buyerId,
                    sellerId,
                    status: "pending",
                    totalAmount,
                    deliveryAddress: buyer.address || "No Street Address provided", // Fallback for address
                    city: buyer.city,
                    upazilla: buyer.upazilla,
                    district: buyer.district,
                    buyerNote,
                    items: {
                        create: items.map(item => ({
                            sellerProductId: item.sellerProductId,
                            quantity: item.quantity,
                            priceAtPurchase: item.sellerProduct.price
                        }))
                    }
                }
            });
            createdOrders.push(order.id);

            // Decrement Stock using Promise.all and atomic check
            await Promise.all(items.map(async (item) => {
                const updated = await tx.sellerProduct.updateMany({
                    where: { 
                        id: item.sellerProductId,
                        stock: { gte: item.quantity } // atomic check
                    },
                    data: { stock: { decrement: item.quantity } }
                });
                
                if (updated.count === 0) {
                    throw new Error(`Insufficient stock for product ID: ${item.sellerProductId} during checkout.`);
                }
            }));
        }

        // Handle payment
        if (paymentMethod === "WALLET") {
            if (buyer.walletBalance < grandTotalAmount) {
                throw new Error("Insufficient wallet balance");
            }
            await tx.buyerProfile.update({
                where: { id: buyerId },
                data: { walletBalance: { decrement: grandTotalAmount } }
            });
        }

        // Clear Cart
        await tx.cartItem.deleteMany({ where: { buyerId } });
    });

    // 6. Track Behaviour
    trackBehaviour(buyerId, "purchase", { orderIds: createdOrders, totalAmount: grandTotalAmount, itemCount: totalItemsCount });

    return NextResponse.json({ success: true, orders: createdOrders });
  } catch (error: any) {
    console.error("Order processing failed:", error);
    const status = (error instanceof Error && error.message.includes("Insufficient stock")) ? 400 : 500;
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status });
  }
}

export async function GET(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const orders = await prisma.order.findMany({
        where: { buyerId: user.id },
        include: {
            seller: { select: { storeName: true } },
            items: {
                include: {
                    sellerProduct: {
                        include: { globalProduct: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ orders });
}

