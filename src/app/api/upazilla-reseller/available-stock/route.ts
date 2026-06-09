import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;

    const availableStock = await prisma.upazillaAvailableStock.findMany({
      where: {
        upazillaResellerId: user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(availableStock);
  } catch (error: any) {
    console.error("Failed to fetch available stock:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
