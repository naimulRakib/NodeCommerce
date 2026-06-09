import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    // We assume the caller is a seller if they are fetching this route.
    // In our system, sellers might have type = "seller" in Profile or we just check if they are authenticated.
    // Assuming requireAuth is sufficient for getting user ID.

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClause: any = {
      sellerId: user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.stockOrderNegotiation.findMany({
      where: whereClause,
      include: {
        upazillaReseller: {
          select: {
            email: true,
            upazilla: true
          }
        },
        sellerProduct: {
          select: {
            stock: true,
            globalProduct: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Failed to fetch seller stock orders:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
