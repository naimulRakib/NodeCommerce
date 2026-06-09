import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const reseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });
    if (!reseller) {
      return NextResponse.json({ error: "District Reseller profile not found" }, { status: 404 });
    }

    const inventory = await prisma.districtStockItem.findMany({
      where: {
        districtResellerId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(inventory);
  } catch (error: any) {
    console.error("Failed to fetch district inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const reseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });
    if (!reseller) {
      return NextResponse.json({ error: "District Reseller profile not found" }, { status: 404 });
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

    const item = await prisma.districtStockItem.create({
      data: {
        districtResellerId: user.id,
        productName: productName.trim(),
        brand: brand ? brand.trim() : null,
        category: category ? category.trim() : null,
        quantity: qty
      }
    });

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Failed to add district inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
