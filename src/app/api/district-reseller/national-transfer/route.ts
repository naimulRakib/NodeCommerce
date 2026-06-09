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
    const { fromDistrictResellerId, stockItemId, quantity } = body;

    const pullQty = parseInt(quantity, 10);
    if (isNaN(pullQty) || pullQty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1 unit." }, { status: 400 });
    }

    if (fromDistrictResellerId === user.id) {
      return NextResponse.json({ error: "You cannot pull stock from your own district." }, { status: 400 });
    }

    // Process pull in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify surplus exists
      const sourceStock = await tx.districtStockItem.findUnique({
        where: { id: stockItemId }
      });

      if (!sourceStock) {
        throw new Error("Stock item not found.");
      }

      const sourceDemand = await tx.districtDemand.findFirst({
        where: {
          districtResellerId: fromDistrictResellerId,
          productName: {
            equals: sourceStock.productName,
            mode: "insensitive"
          }
        }
      });

      const maxSurplus = Math.max(0, sourceStock.quantity - (sourceDemand?.remainingDemand ?? 0));
      if (maxSurplus < pullQty) {
        throw new Error(`Insufficient surplus. Only ${maxSurplus} units available.`);
      }

      // 2. Decrement DistrictStockItem (from source)
      const updatedStockCount = await tx.districtStockItem.updateMany({
        where: {
          id: stockItemId,
          quantity: { gte: pullQty }
        },
        data: {
          quantity: { decrement: pullQty }
        }
      });

      if (updatedStockCount.count === 0) {
        throw new Error("Stock became insufficient or was pulled by another district.");
      }

      // 3. Increment or Create DistrictStockItem (for destination)
      const existingDestStock = await tx.districtStockItem.findFirst({
        where: {
          districtResellerId: user.id,
          productName: {
            equals: sourceStock.productName,
            mode: "insensitive"
          }
        }
      });

      if (existingDestStock) {
        await tx.districtStockItem.update({
          where: { id: existingDestStock.id },
          data: {
            quantity: { increment: pullQty }
          }
        });
      } else {
        await tx.districtStockItem.create({
          data: {
            districtResellerId: user.id,
            productName: sourceStock.productName,
            brand: sourceStock.brand,
            category: sourceStock.category,
            quantity: pullQty
          }
        });
      }

      // 4. Record NationalTransfer
      const transfer = await tx.nationalTransfer.create({
        data: {
          fromDistrictResellerId,
          toDistrictResellerId: user.id,
          stockItemId,
          productName: sourceStock.productName,
          quantity: pullQty,
          status: "accepted" // Automatically accepted since they pulled it
        }
      });

      return transfer;
    });

    return NextResponse.json({ success: true, message: "National surplus stock pulled successfully.", transfer: result });
  } catch (error: any) {
    if (error.message.includes("Insufficient") || error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to pull national stock:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    
    // Fetch national transfers related to the user
    const transfers = await prisma.nationalTransfer.findMany({
      where: {
        OR: [
          { fromDistrictResellerId: user.id },
          { toDistrictResellerId: user.id }
        ]
      },
      include: {
        fromDistrictReseller: { select: { district: true } },
        toDistrictReseller: { select: { district: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json(transfers);
  } catch (error: any) {
    console.error("Failed to fetch national transfers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
