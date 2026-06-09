import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const sellers = await prisma.profile.findMany({
      where: {
        type: "seller"
      },
      select: {
        id: true,
        storeName: true,
        city: true,
        upazilla: true,
        sellerCode: true,
        avatarUrl: true,
        phone: true,
        _count: {
          select: {
            products: {
              where: {
                status: "approved"
              }
            }
          }
        }
      },
      orderBy: {
        storeName: "asc"
      }
    });

    return NextResponse.json(sellers);
  } catch (error: any) {
    console.error("Failed to fetch sellers:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
