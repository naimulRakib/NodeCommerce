import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;


    const inventory = await prisma.upazillaStockItem.findMany({
      where: {
        upazillaResellerId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(inventory);
  } catch (error: any) {
    console.error("Failed to fetch upazilla inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;


    const upazilla = await prisma.upazillaReseller.findUnique({ where: { id: user.id } });
    if (!upazilla) {
      return NextResponse.json({ error: "Forbidden: Not an Upazilla Reseller" }, { status: 403 });
    }

    const body = await req.json();
    const { productName, brand, category, quantity } = body;

    if (!productName || !productName.trim()) {
      return NextResponse.json({ error: "Product Name is required" }, { status: 400 });
    }
    if (productName.trim().length > 255) {
      return NextResponse.json({ error: "Product Name is too long (max 255 characters)" }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 2147483647) {
      return NextResponse.json({ error: "Quantity must be a valid positive number" }, { status: 400 });
    }

    const item = await prisma.upazillaStockItem.create({
      data: {
        upazillaResellerId: user.id,
        productName: productName.trim(),
        brand: brand ? brand.trim() : null,
        category: category ? category.trim() : null,
        quantity: qty
      }
    });

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Failed to add upazilla inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
