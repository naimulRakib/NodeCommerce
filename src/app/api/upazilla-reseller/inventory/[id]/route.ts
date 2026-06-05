import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const itemId = params.id;
    const body = await req.json();
    const { quantity } = body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: "Quantity must be 0 or greater" }, { status: 400 });
    }

    // Verify ownership
    const existingItem = await prisma.upazillaStockItem.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.upazillaResellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this item" }, { status: 403 });
    }

    const updatedItem = await prisma.upazillaStockItem.update({
      where: { id: itemId },
      data: { quantity: qty }
    });

    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error("Failed to update upazilla inventory:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const itemId = params.id;

    // Verify ownership
    const existingItem = await prisma.upazillaStockItem.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.upazillaResellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this item" }, { status: 403 });
    }

    const transferCount = await prisma.stockTransfer.count({
      where: { stockItemId: itemId }
    });

    if (transferCount > 0) {
      return NextResponse.json({ error: "Cannot delete item. It has associated stock transfer history." }, { status: 400 });
    }

    await prisma.upazillaStockItem.delete({
      where: { id: itemId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete upazilla inventory:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
