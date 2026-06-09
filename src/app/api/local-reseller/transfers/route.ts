import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;


    const transfers = await prisma.stockTransfer.findMany({
      take: 200,
      where: {
        localResellerId: user.id
      },
      include: {
        upazillaReseller: {
          select: { email: true, upazilla: true }
        },
        stockItem: {
          select: { productName: true, brand: true, category: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(transfers);
  } catch (error: any) {
    console.error("Failed to fetch incoming transfers:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;


    const body = await req.json();
    const { transferId, action } = body;

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'reject'" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { stockItem: true }
      });

      if (!transfer) throw new Error("Transfer not found");
      if (transfer.localResellerId !== user.id) throw new Error("Forbidden");
      if (transfer.status !== "pending") throw new Error("Transfer is already processed");

      if (action === "accept") {
        // Update transfer status
        await tx.stockTransfer.update({
          where: { id: transferId },
          data: { status: "accepted" }
        });

        // Check if LocalReseller already has this product by customName, ensuring it's an Upazilla transfer (sellerProductId: null)
        const existingStock = await tx.resellerStockItem.findFirst({
          where: {
            resellerId: user.id,
            customName: {
              equals: transfer.stockItem.productName,
              mode: "insensitive"
            },
            sellerProductId: null
          }
        });

        if (existingStock) {
          // Increment existing
          await tx.resellerStockItem.update({
            where: { id: existingStock.id },
            data: { quantity: { increment: transfer.quantity } }
          });
        } else {
          // Create new
          await tx.resellerStockItem.create({
            data: {
              resellerId: user.id,
              customName: transfer.stockItem.productName,
              quantity: transfer.quantity,
              // sellerProductId is optional now
            }
          });
        }
      } else if (action === "reject") {
        // Update transfer status
        await tx.stockTransfer.update({
          where: { id: transferId },
          data: { status: "rejected" }
        });

        // Add quantity back to UpazillaStockItem
        await tx.upazillaStockItem.update({
          where: { id: transfer.stockItem.id },
          data: { quantity: { increment: transfer.quantity } }
        });
      }

      return await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          upazillaReseller: { select: { email: true, upazilla: true } },
          stockItem: { select: { productName: true, brand: true, category: true } }
        }
      });
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to process stock transfer:", error);
    const status = (error instanceof Error ? error.message : String(error)) === "Forbidden" ? 403 : ((error instanceof Error ? error.message : String(error)) === "Transfer is already processed" || (error instanceof Error ? error.message : String(error)) === "Invalid action. Must be 'accept' or 'reject'" ? 400 : 500);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status });
  }
}
