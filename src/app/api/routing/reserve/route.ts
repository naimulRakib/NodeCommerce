import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { stockItemId, productName, availableQuantity } = body;

    if (!stockItemId || !productName) {
      return NextResponse.json({ error: "stockItemId and productName are required" }, { status: 400 });
    }

    if (availableQuantity === undefined || availableQuantity <= 0) {
      return NextResponse.json({ error: "Cannot process zero quantity" }, { status: 400 });
    }

    // Current user should be an upazilla reseller processing this
    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Unauthorized. Only upazilla resellers can run reservations." }, { status: 403 });
    }

    // Verify stock item exists and belongs to a local seller in this upazilla
    const stockItem = await prisma.resellerStockItem.findUnique({
      where: { id: stockItemId },
      include: {
        reseller: true,
        sellerProduct: {
          include: {
            globalProduct: true
          }
        }
      }
    });

    if (!stockItem) {
      return NextResponse.json({ error: "Seller stock item not found" }, { status: 404 });
    }

    if (stockItem.reseller.upazilla !== upazillaReseller.upazilla) {
      return NextResponse.json({ 
        error: "Stock item belongs to a seller outside your upazilla" 
      }, { status: 403 });
    }

    if (stockItem.quantity !== availableQuantity) {
      return NextResponse.json({ 
        error: `Quantity mismatch. Seller stock item has ${stockItem.quantity} units, not ${availableQuantity} units.` 
      }, { status: 400 });
    }

    if (stockItem.isReserved) {
      return NextResponse.json({ 
        error: "This seller stock item has already been processed for reservation." 
      }, { status: 400 });
    }

    const brand = stockItem.sellerProduct?.globalProduct?.brand || null;
    const category = stockItem.sellerProduct?.globalProduct?.category || null;

    // Use $transaction
    const result = await prisma.$transaction(async (tx) => {
      // STEP 0 - Atomic lock check using updateMany
      const lockUpdate = await tx.resellerStockItem.updateMany({
        where: { id: stockItemId, isReserved: false },
        data: { isReserved: true } // temporary lock, will be overwritten by actual logic below
      });
      if (lockUpdate.count === 0) {
        throw new Error("This seller stock item has already been processed for reservation.");
      }

      let action: "reserved" | "no_demand" | "partial" = "no_demand";
      let reserveAmount = 0;
      let surplusAmount = availableQuantity;
      let sentToDistrict = false;
      let districtName: string | null = null;
      let upazillaDemandStatus = "pending";
      let districtRemainingDemand: number | null = null;

      // STEP 1 - Find upazilla demand
      const upazillaDemand = await tx.upazillaDemand.findFirst({
        where: {
          upazillaResellerId: upazillaReseller.id,
          productName: {
            equals: productName,
            mode: "insensitive"
          },
          status: {
            not: "fulfilled"
          }
        }
      });

      // STEP 2 - Calculate reservation
      if (upazillaDemand) {
        const neededQuantity = upazillaDemand.demandQuantity - upazillaDemand.fulfilledQuantity;
        if (neededQuantity > 0) {
          reserveAmount = Math.min(neededQuantity, availableQuantity);
          surplusAmount = availableQuantity - reserveAmount;

          action = surplusAmount > 0 ? "partial" : "reserved";

          // Update LocalSellerStockItem
          await tx.resellerStockItem.update({
            where: { id: stockItemId },
            data: {
              isReserved: reserveAmount > 0,
              reservedQuantity: reserveAmount,
              surplusQuantity: surplusAmount
            }
          });

          // Update UpazillaDemand
          const newFulfilled = upazillaDemand.fulfilledQuantity + reserveAmount;
          upazillaDemandStatus = newFulfilled >= upazillaDemand.demandQuantity
            ? "fulfilled"
            : reserveAmount > 0 ? "partially_fulfilled" : upazillaDemand.status;

          await tx.upazillaDemand.update({
            where: { id: upazillaDemand.id },
            data: {
              fulfilledQuantity: newFulfilled,
              status: upazillaDemandStatus
            }
          });
        } else {
          // Already fully fulfilled
          action = "no_demand";
          surplusAmount = availableQuantity;
          reserveAmount = 0;
        }
      }

      if (action === "no_demand") {
        await tx.resellerStockItem.update({
          where: { id: stockItemId },
          data: {
            surplusQuantity: surplusAmount,
            isReserved: false // revert temporary lock
          }
        });
      }

      // STEP 3 - Push surplus to district hub
      if (surplusAmount > 0) {
        const upazillaInfo = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
        if (!upazillaInfo) {
          throw new Error(`No district mapping found for upazilla ${upazillaReseller.upazilla}`);
        }

        const districtReseller = await tx.districtReseller.findUnique({
          where: { district: upazillaInfo.district }
        });

        if (!districtReseller) {
          throw new Error(`No district reseller found for ${upazillaInfo.district}. Cannot route surplus.`);
        }

        districtName = districtReseller.district;
        sentToDistrict = true;

        // Update or Create DistrictStockItem
        
        const existingDistrictStock = await tx.districtStockItem.findFirst({
          where: {
            districtResellerId: districtReseller.id,
            productName: {
              equals: productName,
              mode: "insensitive"
            }
          }
        });

        if (existingDistrictStock) {
          await tx.districtStockItem.update({
            where: { id: existingDistrictStock.id },
            data: {
              quantity: { increment: surplusAmount }
            }
          });
        } else {
          await tx.districtStockItem.create({
            data: {
              districtResellerId: districtReseller.id,
              productName: stockItem.customName || productName, // Original casing
              brand: brand,
              category: category,
              quantity: surplusAmount
            }
          });
        }

        // Update DistrictDemand if there was a reservation
        if (reserveAmount > 0) {
          const districtDemand = await tx.districtDemand.findUnique({
            where: {
              districtResellerId_productName: {
                districtResellerId: districtReseller.id,
                productName
              }
            }
          });

          if (districtDemand) {
            const newRemainingDemand = Math.max(0, districtDemand.remainingDemand - reserveAmount);
            await tx.districtDemand.update({
              where: { id: districtDemand.id },
              data: {
                remainingDemand: newRemainingDemand
              }
            });
            districtRemainingDemand = newRemainingDemand;
          }
        }
      }

      return {
        action,
        reservedQuantity: reserveAmount,
        surplusQuantity: surplusAmount,
        sentToDistrict,
        districtName,
        upazillaDemandStatus,
        districtRemainingDemand
      };
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Routing reserve POST error:", error);
    if (error?.message?.includes("Cannot route surplus") || error?.message?.includes("No district mapping") || error?.message?.includes("already been processed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
