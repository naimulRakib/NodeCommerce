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
    const { localResellerId, stockItemId, quantity } = body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1" }, { status: 400 });
    }

    // Run within a transaction to ensure atomic deduction and transfer creation
    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Validate UpazillaReseller
      const upazillaReseller = await tx.upazillaReseller.findUnique({
        where: { id: user.id }
      });
      if (!upazillaReseller) throw new Error("Upazilla Reseller profile not found");

      // 2. Validate LocalReseller
      const localReseller = await tx.localReseller.findUnique({
        where: { id: localResellerId }
      });
      if (!localReseller) throw new Error("Local Reseller not found");
      if (localReseller.upazilla !== upazillaReseller.upazilla) {
        throw new Error("Local Reseller is not in your upazilla");
      }

      // 3. Validate StockItem
      const stockItem = await tx.upazillaStockItem.findUnique({
        where: { id: stockItemId }
      });
      if (!stockItem) throw new Error("Stock item not found");
      if (stockItem.upazillaResellerId !== user.id) {
        throw new Error("You do not own this stock item");
      }
      if (stockItem.quantity < qty) {
        throw new Error(`Insufficient stock. You only have ${stockItem.quantity} available.`);
      }

      // 4. Deduct from UpazillaStockItem atomically with a DB-level threshold check
      const updateResult = await tx.upazillaStockItem.updateMany({
        where: { 
          id: stockItemId,
          quantity: { gte: qty }
        },
        data: { quantity: { decrement: qty } }
      });

      if (updateResult.count === 0) {
        throw new Error(`Insufficient stock. The item may have been transferred simultaneously.`);
      }

      // 5. Create pending StockTransfer
      return await tx.stockTransfer.create({
        data: {
          upazillaResellerId: user.id,
          localResellerId: localReseller.id,
          stockItemId: stockItem.id,
          quantity: qty,
          status: "pending"
        }
      });
    });

    return NextResponse.json(transfer);
  } catch (error: any) {
    console.error("Failed to create stock transfer:", error);
    // Determine if it's our thrown error or something else
    const status = ["Upazilla Reseller profile not found", "Local Reseller not found", "Local Reseller is not in your upazilla", "You do not own this stock item"].some(msg => error.message.includes(msg)) || error.message.includes("Insufficient stock") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;


    const transfers = await prisma.stockTransfer.findMany({
      where: {
        upazillaResellerId: user.id
      },
      include: {
        localReseller: {
          select: { username: true }
        },
        stockItem: {
          select: { productName: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(transfers);
  } catch (error: any) {
    console.error("Failed to fetch transfer history:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
