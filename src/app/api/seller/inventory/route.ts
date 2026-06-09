import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { ensureSellerCode } from "@/lib/ensure-seller-code";
import { buildQRString } from "@/lib/qr";
import { generateProductCodeForSeller } from "@/lib/codes";

/**
 * Thrown inside the create transaction to signal "this seller already has
 * a SellerProduct for that global product". Caught at the boundary and
 * translated to a 409 so the client can switch into update mode.
 */
class DuplicateSellerProductError extends Error {
  existing: {
    id: string;
    stock: number;
    price: number;
    productCode: string;
    status: string;
  };
  constructor(existing: {
    id: string;
    stock: number;
    price: number;
    productCode: string;
    status: string;
  }) {
    super("Product already exists in your inventory");
    this.name = "DuplicateSellerProductError";
    this.existing = existing;
  }
}

/**
 * GET /api/seller/inventory
 *
 * Lists every SellerProduct owned by the current seller, plus the seller's
 * sellerCode. This route exists so the seller inventory URL pattern is
 * symmetric with the other roles (district/upazilla/local-reseller all expose
 * `/api/<role>/inventory`).
 */
export async function GET() {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { sellerCode: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const products = await prisma.sellerProduct.findMany({
      where: { sellerId: user.id },
      include: { globalProduct: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      products,
      sellerCode: profile.sellerCode,
    });
  } catch (error: any) {
    console.error("Failed to fetch seller inventory:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/seller/inventory
 *
 * Creates a new SellerProduct (or attaches to an existing GlobalProduct when
 * `globalProductId` is provided). Mirrors `/api/seller/product` POST so the
 * two endpoints are interchangeable from the UI.
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

    let profile: any = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Make sure the seller has a sellerCode before we generate a QR.
    profile = await ensureSellerCode(profile);

    const body = await request.json();
    const {
      globalProductId,
      customName,
      price,
      stock,
      category,
      brand,
      description,
    } = body;

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    if (Number.isNaN(parsedPrice) || Number.isNaN(parsedStock)) {
      return NextResponse.json(
        { error: "Invalid price or stock" },
        { status: 400 },
      );
    }
    if (parsedPrice < 0 || parsedStock < 0) {
      return NextResponse.json(
        { error: "Price and stock must be non-negative" },
        { status: 400 },
      );
    }

    const newSellerProduct = await prisma.$transaction(async (tx) => {
      let finalGlobalProductId = globalProductId;

      if (!finalGlobalProductId) {
        const productName = customName || "Unknown Product";

        const existingGlobalProduct = await tx.globalProduct.findFirst({
          where: {
            name: { equals: productName, mode: "insensitive" },
            ...(brand
              ? { brand: { equals: brand, mode: "insensitive" } }
              : {}),
          },
        });

        if (existingGlobalProduct) {
          finalGlobalProductId = existingGlobalProduct.id;
        } else {
          const newGlobalProduct = await tx.globalProduct.create({
            data: {
              name: productName,
              category: category || "Uncategorized",
              brand: brand || null,
              description: description || null,
            },
          });
          finalGlobalProductId = newGlobalProduct.id;
        }
      }

      // Duplicate guard: same seller must not own two SellerProduct rows
      // for the same GlobalProduct — stock/price should be updated on the
      // existing row instead. We surface 409 with the existing product
      // id so the client can switch to update mode.
      const duplicate = await tx.sellerProduct.findFirst({
        where: { sellerId: user.id, globalProductId: finalGlobalProductId },
        select: {
          id: true,
          stock: true,
          price: true,
          productCode: true,
          status: true,
        },
      });
      if (duplicate) {
        throw new DuplicateSellerProductError(duplicate);
      }

      // Reserve a fresh productCode + placeholder row inside the same
      // transaction. The `generateProductCodeForSeller` helper does the
      // real `sellerProduct.create` with `sellerId` and a pending status
      // inside a P2002 retry loop. If anything below this point throws
      // the transaction rolls back, releasing the placeholder row.
      const placeholder = await generateProductCodeForSeller(user.id);
      const ratingDensity = 0;

      const qrCode = buildQRString(
        profile.sellerCode,
        finalGlobalProductId,
        parsedPrice,
        ratingDensity,
      );

      return tx.sellerProduct.update({
        where: { id: placeholder.id },
        data: {
          globalProductId: finalGlobalProductId,
          customName: customName || null,
          stock: parsedStock,
          price: parsedPrice,
          qrCode,
          status: "approved",
        },
        include: { globalProduct: true },
      });
    });

    return NextResponse.json({ success: true, product: newSellerProduct });
  } catch (error: any) {
    if (error instanceof DuplicateSellerProductError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "DUPLICATE_SELLER_PRODUCT",
          existing: error.existing,
        },
        { status: 409 },
      );
    }
    console.error("Failed to create seller inventory item:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
