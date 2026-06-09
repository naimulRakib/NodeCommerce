import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });
    if (!districtReseller) {
      return NextResponse.json({ error: "District Reseller profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { upazillaResellerId, sourceStockItemId, quantity } = body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1 unit." }, { status: 400 });
    }
    if (qty > 10000) {
      return NextResponse.json({ error: "Quantity cannot exceed 10,000 units per transfer." }, { status: 400 });
    }

    if (!sourceStockItemId || typeof sourceStockItemId !== "string" || !sourceStockItemId.trim()) {
      return NextResponse.json({ error: "Stock item not found." }, { status: 400 });
    }

    // Check DistrictStockItem
    const stockItem = await prisma.districtStockItem.findUnique({
      where: { id: sourceStockItemId }
    });

    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found." }, { status: 400 });
    }

    if (stockItem.districtResellerId !== user.id) {
      return NextResponse.json({ error: "This stock item does not belong to your district hub." }, { status: 400 });
    }

    if (stockItem.quantity <= 0) {
      return NextResponse.json({ error: "Cannot transfer from an empty stock item." }, { status: 400 });
    }

    if (stockItem.quantity < qty) {
      return NextResponse.json({ error: `Insufficient stock. You have ${stockItem.quantity} units available, not ${qty} units.` }, { status: 400 });
    }

    if (!upazillaResellerId || typeof upazillaResellerId !== "string" || !upazillaResellerId.trim()) {
      return NextResponse.json({ error: "Upazilla reseller not found." }, { status: 400 });
    }

    // Check UpazillaReseller
    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: upazillaResellerId }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Upazilla reseller not found." }, { status: 400 });
    }

    // Check if UpazillaReseller belongs to district
    const upazillaData = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
    if (!upazillaData || upazillaData.district !== districtReseller.district) {
      return NextResponse.json(
        { error: `Cannot send stock to an upazilla outside your district. ${upazillaReseller.upazilla} belongs to ${upazillaData?.district || 'Unknown'}, not ${districtReseller.district}.` },
        { status: 403 }
      );
    }

    // Check existing PENDING transfer
    const existingTransfer = await prisma.districtTransfer.findFirst({
      where: {
        districtResellerId: user.id,
        upazillaResellerId: upazillaResellerId,
        productName: stockItem.productName,
        status: "pending"
      }
    });

    if (existingTransfer) {
      return NextResponse.json({ error: `A pending transfer for ${stockItem.productName} already exists for this upazilla. Wait for it to be accepted or rejected first.` }, { status: 400 });
    }

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct quantity atomically
      const updatedStockCount = await tx.districtStockItem.updateMany({
        where: { 
          id: sourceStockItemId,
          quantity: { gte: qty }
        },
        data: {
          quantity: {
            decrement: qty
          }
        }
      });

      if (updatedStockCount.count === 0) {
        throw new Error("Stock became insufficient. Please refresh and try again.");
      }

      // Create DistrictTransfer
      const newTransfer = await tx.districtTransfer.create({
        data: {
          districtResellerId: user.id,
          upazillaResellerId,
          stockItemId: sourceStockItemId,
          productName: stockItem.productName,
          quantity: qty,
          status: "pending"
        }
      });

      // Get updated stock item for returning
      const updatedDistrictStockItem = await tx.districtStockItem.findUnique({
        where: { id: sourceStockItemId }
      });

      return {
        transfer: newTransfer,
        remainingStock: updatedDistrictStockItem?.quantity || 0,
        productName: stockItem.productName,
        targetUpazilla: upazillaReseller.upazilla
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Stock became insufficient. Please refresh and try again.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to execute transfer:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const transfers = await prisma.districtTransfer.findMany({
      take: 200,
      where: {
        districtResellerId: user.id
      },
      include: {
        upazillaReseller: {
          select: {
            email: true,
            upazilla: true
          }
        },
        stockItem: {
          select: {
            productName: true,
            brand: true,
            category: true,
            quantity: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Handle edge case where stockItem is deleted
    const formattedTransfers = transfers.map(t => {
      if (!t.stockItem) {
        return { ...t, stockItem: null, productName: t.productName };
      }
      return t;
    });

    return NextResponse.json(formattedTransfers);
  } catch (error: any) {
    console.error("Failed to fetch transfer history:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
