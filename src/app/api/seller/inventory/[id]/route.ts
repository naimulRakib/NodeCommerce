import { NextResponse } from "next/server";
import { getOwnedSellerProduct } from "@/lib/inventory-auth";
import { prisma } from "@/lib/prisma";
import { buildQRString } from "@/lib/qr";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { ensureSellerCode } from "@/lib/ensure-seller-code";

function parseStock(value) {
  const stock = Number(value);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Stock must be a whole number of 0 or greater");
  }
  return stock;
}

function parsePrice(value) {
  const price = Number(value);
  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a number of 0 or greater");
  }
  return price;
}

export async function PATCH(request, { params }) {
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

  const { id } = await params;
  const { error, product } = await getOwnedSellerProduct(id, user.id);

  if (error === "not_found") {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: any = {};
  const allowed = ["stock", "price"];
  const keys = Object.keys(body ?? {});

  if (keys.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  for (const key of keys) {
    if (!allowed.includes(key)) {
      return NextResponse.json(
        { error: `Field "${key}" is not allowed. Only stock and price can be updated.` },
        { status: 400 }
      );
    }
  }

  try {
    if ("stock" in body) {
      data.stock = parseStock(body.stock);
    }
    if ("price" in body) {
      data.price = parsePrice(body.price);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 400 }
    );
  }

  const profile: any = await ensureSellerCode(
    await prisma.profile.findUnique({
      where: { id: user.id },
      select: { sellerCode: true },
    })
  );

  const nextPrice = "price" in data ? data.price : product.price;

  if (profile?.sellerCode) {
    data.qrCode = buildQRString(
      profile.sellerCode,
      product.productCode,
      nextPrice
    );
  }

  const updated = await prisma.sellerProduct.update({
    where: { id },
    data,
    include: { globalProduct: true },
  });

  return NextResponse.json({ product: updated });
}

export async function DELETE(_request, { params }) {
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

  const { id } = await params;
  const { error } = await getOwnedSellerProduct(id, user.id);

  if (error === "not_found") {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.sellerProduct.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
