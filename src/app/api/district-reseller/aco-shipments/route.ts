import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
  if (roleError) return roleError;

  try {
    const shipments = await prisma.aCOShipment.findMany({
      where: {
        OR: [
          { fromId: user.id },
          { toId: user.id }
        ]
      },
      include: {
        lineItems: true,
        job: {
          select: {
            startedAt: true,
            status: true
          }
        }
      },
      orderBy: {
        id: "desc", // Sort by newest
      },
    });

    return NextResponse.json(shipments);
  } catch (error: any) {
    console.error("Error fetching district ACO shipments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
