import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const body = await req.json();
    const { stockId, quantity } = body;

    const pullQty = parseInt(quantity, 10);
    if (isNaN(pullQty) || pullQty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1 unit." }, { status: 400 });
    }

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });

    if (!districtReseller) {
      return NextResponse.json({ error: "District reseller profile not found." }, { status: 404 });
    }

    const availableStock = await prisma.upazillaAvailableStock.findUnique({
      where: { id: stockId },
      include: {
        upazillaReseller: true
      }
    });

    if (!availableStock) {
      return NextResponse.json({ error: "Stock item not found." }, { status: 404 });
    }

    if (!availableStock.isVisibleToDistrict) {
      return NextResponse.json({ error: "This stock is no longer visible to the district." }, { status: 400 });
    }

    if (availableStock.availableQty < pullQty) {
      return NextResponse.json({ error: `Insufficient stock. Only ${availableStock.availableQty} units available.` }, { status: 400 });
    }

    // Process pull in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Decrement UpazillaAvailableStock
      const updatedStockCount = await tx.upazillaAvailableStock.updateMany({
        where: {
          id: stockId,
          availableQty: { gte: pullQty }
        },
        data: {
          availableQty: { decrement: pullQty }
        }
      });

      if (updatedStockCount.count === 0) {
        throw new Error("Stock became insufficient or was pulled by another district.");
      }

      // 2. Increment or Create DistrictStockItem
      const existingDistrictStock = await tx.districtStockItem.findFirst({
        where: {
          districtResellerId: user.id,
          productName: {
            equals: availableStock.productName,
            mode: "insensitive"
          }
        }
      });

      if (existingDistrictStock) {
        await tx.districtStockItem.update({
          where: { id: existingDistrictStock.id },
          data: {
            quantity: { increment: pullQty }
          }
        });
      } else {
        await tx.districtStockItem.create({
          data: {
            districtResellerId: user.id,
            productName: availableStock.productName,
            brand: availableStock.brand,
            category: availableStock.category,
            quantity: pullQty
          }
        });
      }
    });

    return NextResponse.json({ success: true, message: "Stock pulled successfully." });
  } catch (error: any) {
    if (error.message === "Stock became insufficient or was pulled by another district.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to pull upazilla stock:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
