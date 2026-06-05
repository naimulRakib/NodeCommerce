import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { ensureSellerCode } from "@/lib/ensure-seller-code";
import { buildQRString } from "@/lib/qr";

// Utility to generate the 6-character unique product code
function generateProductCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request) {
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

  let profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Ensure the seller has a unique sellerCode
  profile = await ensureSellerCode(profile);

  const body = await request.json();
  const { globalProductId, customName, price, stock, category, brand, description } = body;

  let finalGlobalProductId = globalProductId;

  // SCENARIO 1: The product is entirely new (Custom Product)
  if (!finalGlobalProductId) {
    const newGlobalProduct = await prisma.globalProduct.create({
      data: {
        name: customName || "Unknown Product",
        category: category || "Uncategorized",
        brand: brand || null,
        description: description || null,
      },
    });
    finalGlobalProductId = newGlobalProduct.id;
  }

  // Generate unique product code for this specific seller's inventory
  const productCode = generateProductCode();

  // Default rating density for a brand new entry is 0
  const ratingDensity = 0;

  // Generate the dynamic QR Code string
  const qrCode = buildQRString(
    profile.sellerCode,
    finalGlobalProductId,
    price,
    ratingDensity
  );

  // SCENARIO 2: Create the SellerProduct (Links Seller -> GlobalProduct)
  const newSellerProduct = await prisma.sellerProduct.create({
    data: {
      sellerId: user.id,
      globalProductId: finalGlobalProductId,
      customName: customName || null,
      stock: Number(stock),
      price: Number(price),
      productCode: productCode,
      qrCode: qrCode,
      status: "approved", // Bypassing AI verification
    },
    include: {
      globalProduct: true,
    }
  });

  return NextResponse.json({
    success: true,
    product: newSellerProduct
  });
}
export async function GET(request) {
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
}
