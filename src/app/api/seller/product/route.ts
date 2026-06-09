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

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

    let profile: any = await prisma.profile.findUnique({
      where: { id: user.id }
    }) || {};
    
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Ensure the seller has a unique sellerCode
    profile = await ensureSellerCode(profile);

    const body = await request.json();
    const { globalProductId, customName, price, stock, category, brand, description } = body;

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    if (isNaN(parsedPrice) || isNaN(parsedStock)) {
      return NextResponse.json({ error: "Invalid price or stock" }, { status: 400 });
    }

    // Use a transaction to ensure both GlobalProduct and the final
    // SellerProduct are written atomically. The transaction also runs the
    // duplicate detection up front so we never reserve a productCode only
    // to discover a row already exists.
    const newSellerProduct = await prisma.$transaction(async (tx) => {
      let finalGlobalProductId = globalProductId;

      // SCENARIO 1: The product is entirely new (Custom Product)
      if (!finalGlobalProductId) {
        const productName = customName || "Unknown Product";

        // Fuzzy search for deduplication
        const existingGlobalProduct = await tx.globalProduct.findFirst({
          where: {
            name: { equals: productName, mode: 'insensitive' },
            ...(brand ? { brand: { equals: brand, mode: 'insensitive' } } : {})
          }
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

      // SCENARIO 2: Duplicate guard. The same seller must not own two
      // SellerProduct rows for the same GlobalProduct — stock/price should
      // be updated on the existing row instead. We surface 409 with the
      // existing product id so the client can switch to update mode.
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
        // Abort the transaction with a typed error; the catch below
        // translates it to a 409 response.
        throw new DuplicateSellerProductError(duplicate);
      }

      // Reserve a fresh productCode + placeholder row inside the same
      // transaction. The `generateProductCodeForSeller` helper does the
      // real `sellerProduct.create` with `sellerId` and a pending status
      // inside a P2002 retry loop. If anything below this point throws
      // the transaction rolls back, releasing the placeholder row.
      const placeholder = await generateProductCodeForSeller(user.id);
      // Default rating density for a brand new entry is 0
      const ratingDensity = 0;

      // Generate the dynamic QR Code string
      const qrCode = buildQRString(
        profile.sellerCode,
        finalGlobalProductId,
        parsedPrice,
        ratingDensity
      );

      // Update the placeholder SellerProduct in place with the real
      // fields. The `id` from the helper IS the placeholder row, so this
      // is effectively a "complete the pending row" rather than a 2nd
      // create — which is what the original code intended.
      return await tx.sellerProduct.update({
        where: { id: placeholder.id },
        data: {
          globalProductId: finalGlobalProductId,
          customName: customName || null,
          stock: parsedStock,
          price: parsedPrice,
          qrCode: qrCode,
          status: "approved", // Bypassing AI verification
        },
        include: {
          globalProduct: true,
        }
      });
    });

    return NextResponse.json({
      success: true,
      product: newSellerProduct
    });
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
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
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
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
