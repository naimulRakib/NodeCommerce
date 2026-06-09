import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const itemId = params.id;
    const body = await req.json();
    const { quantity } = body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: "Quantity must be 0 or greater" }, { status: 400 });
    }

    // Verify ownership
    const existingItem = await prisma.districtStockItem.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.districtResellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this item" }, { status: 403 });
    }

    const updatedItem = await prisma.districtStockItem.update({
      where: { id: itemId },
      data: { quantity: qty }
    });

    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error("Failed to update district inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
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

    const itemId = params.id;

    // Verify ownership
    const existingItem = await prisma.districtStockItem.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.districtResellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this item" }, { status: 403 });
    }

    const transfers = await prisma.districtTransfer.findMany({
      where: { stockItemId: itemId }
    });

    if (transfers.length > 0) {
      const hasPending = transfers.some(t => t.status === "pending");
      if (hasPending) {
        return NextResponse.json(
          { error: "Cannot delete. Item has a pending transfer in progress." },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: "Cannot delete. Item has transfer history attached." },
          { status: 400 }
        );
      }
    }

    await prisma.districtStockItem.delete({
      where: { id: itemId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete district inventory:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
