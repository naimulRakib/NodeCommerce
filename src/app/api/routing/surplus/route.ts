import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { stockItemId, quantity } = body;

    if (!stockItemId || quantity === undefined) {
      return NextResponse.json({ error: "stockItemId and quantity are required" }, { status: 400 });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be integer > 0" }, { status: 400 });
    }

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Unauthorized. Only upazilla resellers can manually route surplus." }, { status: 403 });
    }

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

    if (!stockItem.isReserved && stockItem.surplusQuantity === 0) {
      return NextResponse.json({ 
        error: "Run reservation check first before manually routing surplus." 
      }, { status: 400 });
    }

    if (quantity > stockItem.surplusQuantity) {
      return NextResponse.json({ 
        error: `You can only send surplus stock. This seller stock item has ${stockItem.surplusQuantity} surplus units, not ${quantity}.` 
      }, { status: 400 });
    }

    const brand = stockItem.sellerProduct?.globalProduct?.brand || null;
    const category = stockItem.sellerProduct?.globalProduct?.category || null;
    const productName = stockItem.sellerProduct?.globalProduct?.name || stockItem.customName || "Unknown Product";

    const upazillaInfo = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
    if (!upazillaInfo) {
      return NextResponse.json({ error: `No district mapping found for upazilla ${upazillaReseller.upazilla}` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const districtReseller = await tx.districtReseller.findUnique({
        where: { district: upazillaInfo.district }
      });

      if (!districtReseller) {
        throw new Error(`No district reseller found for ${upazillaInfo.district}. Cannot route surplus.`);
      }

      // Deduct quantity from LocalSellerStockItem surplusQuantity
      const updatedStockItem = await tx.resellerStockItem.update({
        where: { id: stockItemId },
        data: {
          surplusQuantity: { decrement: quantity }
        }
      });

      // Upsert DistrictStockItem
      const existingDistrictStock = await tx.districtStockItem.findFirst({
        where: {
          districtResellerId: districtReseller.id,
          productName: {
            equals: productName,
            mode: "insensitive"
          }
        }
      });

      let districtStock;
      if (existingDistrictStock) {
        districtStock = await tx.districtStockItem.update({
          where: { id: existingDistrictStock.id },
          data: {
            quantity: { increment: quantity }
          }
        });
      } else {
        districtStock = await tx.districtStockItem.create({
          data: {
            districtResellerId: districtReseller.id,
            productName: productName,
            brand: brand,
            category: category,
            quantity: quantity
          }
        });
      }

      return { stockItem: updatedStockItem, districtStock };
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Routing surplus POST error:", error);
    if (error?.message?.includes("Cannot route surplus")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const stockItemId = searchParams.get("stockItemId");

    if (!stockItemId) {
      return NextResponse.json({ error: "stockItemId query parameter is required" }, { status: 400 });
    }

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

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller || stockItem.reseller.upazilla !== upazillaReseller.upazilla) {
      return NextResponse.json({ error: "Unauthorized. Stock item belongs to a seller outside your upazilla." }, { status: 403 });
    }

    const productName = stockItem.sellerProduct?.globalProduct?.name || stockItem.customName || "";

    const demand = await prisma.upazillaDemand.findFirst({
      where: {
        upazillaResellerId: user.id,
        productName: {
          equals: productName,
          mode: "insensitive"
        }
      }
    });

    const upazillaInfo = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
    let districtStock = null;
    let sentToDistrictCount = 0;

    if (upazillaInfo) {
      const districtReseller = await prisma.districtReseller.findUnique({
        where: { district: upazillaInfo.district }
      });

      if (districtReseller) {
        districtStock = await prisma.districtStockItem.findFirst({
          where: {
            districtResellerId: districtReseller.id,
            productName: {
              equals: productName,
              mode: "insensitive"
            }
          }
        });
      }
    }

    if (stockItem.isReserved || stockItem.surplusQuantity > 0) {
        sentToDistrictCount = stockItem.quantity - stockItem.reservedQuantity - stockItem.surplusQuantity;
    }

    return NextResponse.json({
      stockItem,
      demand,
      districtStock,
      routingSummary: {
        totalSellerStock: stockItem.quantity,
        reservedForUpazilla: stockItem.reservedQuantity,
        sentToDistrict: sentToDistrictCount,
        remainsUnrouted: stockItem.surplusQuantity
      }
    });

  } catch (error: any) {
    console.error("Routing surplus GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
