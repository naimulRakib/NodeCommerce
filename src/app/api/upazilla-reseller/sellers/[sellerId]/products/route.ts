import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sellerId: string }> }
) {
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

    const resolvedParams = await params;
    
    const seller = await prisma.profile.findUnique({
      where: { id: resolvedParams.sellerId }
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (seller.upazilla !== upazillaReseller.upazilla) {
      return NextResponse.json(
        { error: "This seller is not in your upazilla" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get("productCode");

    const whereClause: any = {
      sellerId: resolvedParams.sellerId,
      status: "approved",
      stock: { gt: 0 }
    };

    if (productCode) {
      whereClause.productCode = productCode;
    }

    const products = await prisma.sellerProduct.findMany({
      where: whereClause,
      select: {
        id: true,
        productCode: true,
        customName: true,
        stock: true,
        price: true,
        globalProduct: {
          select: {
            name: true,
            brand: true,
            category: true,
            imageUrl: true
          }
        }
      }
    });

    const productsWithDisplayName = products.map((p) => ({
      ...p,
      displayName: p.globalProduct?.name ?? p.customName ?? "Unknown Product"
    })).sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json(productsWithDisplayName);
  } catch (error: any) {
    console.error("Failed to fetch seller products:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
