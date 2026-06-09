import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;

    // Fetch all global seller products
    const products = await prisma.sellerProduct.findMany({
      where: {
        status: "approved"
      },
      include: {
        seller: {
          select: {
            storeName: true,
            city: true,
            upazilla: true,
            sellerCode: true
          }
        }
      },
      orderBy: {
        customName: "asc"
      }
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("Failed to fetch global products:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
