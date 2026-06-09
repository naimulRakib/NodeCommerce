import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const body = await req.json();
    const { sellerProductId, requestedQuantity, negotiatedPrice, upazillaNote } = body;

    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      return NextResponse.json({ error: "Requested quantity must be an integer greater than 0" }, { status: 400 });
    }

    if (typeof negotiatedPrice !== "number" || negotiatedPrice <= 0) {
      return NextResponse.json({ error: "Negotiated price must be greater than 0" }, { status: 400 });
    }

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const sellerProduct = await prisma.sellerProduct.findUnique({
      where: { id: sellerProductId, status: "approved" },
      include: {
        seller: true,
        globalProduct: true
      }
    });

    if (!sellerProduct || sellerProduct.status !== "approved") {
      return NextResponse.json({ error: "Product not found or not approved" }, { status: 400 });
    }

    if (sellerProduct.seller.upazilla !== upazillaReseller.upazilla) {
      return NextResponse.json({ error: "Seller is not in your upazilla" }, { status: 400 });
    }

    if (requestedQuantity > sellerProduct.stock) {
      return NextResponse.json({ error: `Cannot order more than available stock. Seller has ${sellerProduct.stock} units available.` }, { status: 400 });
    }

    const originalPrice = sellerProduct.price;
    if (negotiatedPrice > originalPrice * 2) {
      return NextResponse.json({ error: "Negotiated price seems too high." }, { status: 400 });
    }

    if (negotiatedPrice < originalPrice * 0.5) {
      return NextResponse.json({ error: `Negotiated price is too low. Minimum is ${originalPrice * 0.5} BDT.` }, { status: 400 });
    }

    const existingOrder = await prisma.stockOrderNegotiation.findFirst({
      where: {
        upazillaResellerId: user.id,
        sellerProductId,
        status: { in: ["pending", "countered"] }
      }
    });

    if (existingOrder) {
      return NextResponse.json({ error: "You already have an active order for this product. Wait for seller response before placing another." }, { status: 400 });
    }

    const productName = sellerProduct.globalProduct?.name ?? sellerProduct.customName ?? "Unknown Product";

    const order = await prisma.stockOrderNegotiation.create({
      data: {
        upazillaResellerId: user.id,
        sellerId: sellerProduct.sellerId,
        sellerProductId: sellerProduct.id,
        productCode: sellerProduct.productCode,
        productName,
        requestedQuantity,
        originalPrice,
        negotiatedPrice,
        status: "pending",
        upazillaNote
      }
    });

    return NextResponse.json(order);

  } catch (error: any) {
    console.error("Failed to place stock order:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClause: any = {
      upazillaResellerId: user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.stockOrderNegotiation.findMany({
      where: whereClause,
      include: {
        seller: {
          select: {
            storeName: true,
            upazilla: true
          }
        },
        sellerProduct: {
          select: {
            stock: true,
            globalProduct: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Failed to fetch stock orders:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
