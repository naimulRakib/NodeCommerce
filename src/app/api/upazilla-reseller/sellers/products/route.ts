import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get("productCode");

    if (!productCode) {
      return NextResponse.json({ error: "productCode is required" }, { status: 400 });
    }

    const product = await prisma.sellerProduct.findFirst({
      where: {
        productCode: productCode,
        status: "approved",
        stock: { gt: 0 },
        seller: {
          upazilla: upazillaReseller.upazilla
        }
      },
      include: {
        seller: {
          select: {
            storeName: true
          }
        },
        globalProduct: {
          select: {
            name: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json({ error: "Product code not found in your upazilla's seller stock" }, { status: 404 });
    }

    const productName = product.globalProduct?.name ?? product.customName ?? "Unknown Product";

    return NextResponse.json({
      productName,
      storeName: product.seller.storeName,
      price: product.price,
      sellerId: product.sellerId,
      sellerProductId: product.id
    });
  } catch (error: any) {
    console.error("Failed to fetch product by code:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
