import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const transfers = await prisma.districtTransfer.findMany({
      take: 200,
      where: {
        upazillaResellerId: user.id
      },
      include: {
        districtReseller: {
          select: {
            email: true,
            district: true
          }
        },
        stockItem: {
          select: {
            productName: true,
            brand: true,
            category: true
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
    console.error("Failed to fetch district transfers:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { transferId, action } = body;

    if (!transferId || !action || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ error: "Invalid action or transferId" }, { status: 400 });
    }

    const transfer = await prisma.districtTransfer.findUnique({
      where: { id: transferId },
      include: {
        stockItem: true
      }
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.upazillaResellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this transfer" }, { status: 403 });
    }

    if (transfer.status !== "pending") {
      return NextResponse.json({ error: "Transfer already processed" }, { status: 400 });
    }

    const productName = transfer.stockItem ? transfer.stockItem.productName : transfer.productName;

    if (action === "accept") {
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        // Mark transfer as accepted atomically
        const result = await tx.districtTransfer.updateMany({
          where: { id: transferId, status: "pending" },
          data: { status: "accepted" }
        });

        if (result.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        const updated = await tx.districtTransfer.findUnique({
          where: { id: transferId },
          include: {
            districtReseller: { select: { email: true, district: true } },
            stockItem: { select: { productName: true, brand: true, category: true } }
          }
        });

        if (!productName) {
           throw new Error("Product name could not be determined");
        }

        // Find existing UpazillaStockItem with case-insensitive name match
        const existingStock = await tx.upazillaStockItem.findFirst({
          where: {
            upazillaResellerId: user.id,
            productName: {
              equals: productName,
              mode: "insensitive"
            }
          }
        });

        if (existingStock) {
          // Increment quantity
          await tx.upazillaStockItem.update({
            where: { id: existingStock.id },
            data: {
              quantity: {
                increment: transfer.quantity
              }
            }
          });
        } else {
          // Create new UpazillaStockItem
          await tx.upazillaStockItem.create({
            data: {
              upazillaResellerId: user.id,
              productName: productName,
              brand: transfer.stockItem?.brand || null,
              category: transfer.stockItem?.category || null,
              quantity: transfer.quantity
            }
          });
        }

        // Update UpazillaDemand fulfilledQuantity
        const upazillaDemand = await tx.upazillaDemand.findFirst({
          where: {
            upazillaResellerId: user.id,
            productName: {
              equals: productName,
              mode: "insensitive"
            }
          }
        });

        if (upazillaDemand && upazillaDemand.fulfilledQuantity < upazillaDemand.demandQuantity) {
          const newFulfilled = Math.min(upazillaDemand.demandQuantity, upazillaDemand.fulfilledQuantity + transfer.quantity);
          const status = newFulfilled >= upazillaDemand.demandQuantity ? "fulfilled" : "partially_fulfilled";
          
          await tx.upazillaDemand.update({
            where: { id: upazillaDemand.id },
            data: {
              fulfilledQuantity: newFulfilled,
              status: status
            }
          });
        }

        // Update DistrictDemand if it exists (but we must update fulfilledByUpazillas on DistrictStockItem, or remainingDemand)
        // Wait, the prompt explicitly said: "Find DistrictDemand for same productName... increment fulfilledByUpazillas"
        // But DistrictDemand does not have fulfilledByUpazillas, DistrictStockItem does!
        // To strictly follow the prompt without causing TS errors:
        // DistrictDemand has `remainingDemand`. I will decrement `remainingDemand` on DistrictDemand,
        // and I will increment `fulfilledByUpazillas` on the DistrictStockItem.
        if (transfer.districtResellerId) {
          // 1. Update DistrictDemand remainingDemand
          const districtDemand = await tx.districtDemand.findFirst({
            where: {
              districtResellerId: transfer.districtResellerId,
              productName: {
                equals: productName,
                mode: "insensitive"
              }
            }
          });

          if (districtDemand && districtDemand.remainingDemand > 0) {
            await tx.districtDemand.update({
              where: { id: districtDemand.id },
              data: {
                remainingDemand: {
                  decrement: Math.min(transfer.quantity, districtDemand.remainingDemand)
                }
              }
            });
          }

          // 2. Update DistrictStockItem fulfilledByUpazillas
          if (transfer.stockItemId) {
            await tx.districtStockItem.update({
              where: { id: transfer.stockItemId },
              data: {
                fulfilledByUpazillas: {
                  increment: transfer.quantity
                }
              }
            }).catch(() => {});
          }
        }

        return updated;
      });

      return NextResponse.json(updatedTransfer);
    } else {
      // action === "reject"
      let stockItemMissing = false;
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        // Mark transfer as rejected atomically
        const result = await tx.districtTransfer.updateMany({
          where: { id: transferId, status: "pending" },
          data: { status: "rejected" }
        });

        if (result.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        const updated = await tx.districtTransfer.findUnique({
          where: { id: transferId },
          include: {
            districtReseller: { select: { email: true, district: true } },
            stockItem: { select: { productName: true, brand: true, category: true } }
          }
        });

        if (transfer.stockItemId) {
          const targetStock = await tx.districtStockItem.findUnique({
            where: { id: transfer.stockItemId }
          });
          
          if (targetStock) {
            // Restore quantity to DistrictStockItem
            await tx.districtStockItem.update({
              where: { id: transfer.stockItemId },
              data: {
                quantity: {
                  increment: transfer.quantity
                }
              }
            });
          } else {
            stockItemMissing = true;
          }
        } else {
           stockItemMissing = true;
        }

        return updated;
      });

      if (stockItemMissing) {
         console.warn(`Stock item ${transfer.stockItemId} no longer exists, quantity ${transfer.quantity} cannot be restored`);
         return NextResponse.json({ 
           ...updatedTransfer, 
           warning: "Transfer rejected, but stock item no longer exists so quantity could not be restored." 
         });
      }

      return NextResponse.json(updatedTransfer);
    }
  } catch (error: any) {
    if ((error instanceof Error ? error.message : String(error)) === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Transfer already processed" }, { status: 400 });
    }
    console.error("Failed to update district transfer status:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
