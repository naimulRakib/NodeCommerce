import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;


    const inventory = await prisma.resellerStockItem.findMany({
      where: {
        resellerId: user.id
      },
      include: {
        sellerProduct: {
          select: {
            id: true,
            price: true,
            stock: true,
            productCode: true,
            customName: true,
            status: true,
            globalProduct: {
              select: {
                name: true,
                brand: true,
                category: true,
                imageUrl: true
              }
            },
            seller: {
              select: {
                storeName: true,
                city: true,
                upazilla: true
              }
            }
          }
        }
      },
      orderBy: {
        assignedAt: 'desc'
      }
    });

    return NextResponse.json(inventory);
  } catch (error: any) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
