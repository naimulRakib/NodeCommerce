import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "upazilla_reseller");
    if (roleError) return roleError;


    // 1. Fetch UpazillaReseller profile to get their upazilla value
    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: user.id }
    });

    if (!upazillaReseller) {
      return NextResponse.json({ error: "Upazilla Reseller profile not found" }, { status: 404 });
    }

    // 2. Fetch all LocalResellers in the same upazilla
    const localResellers = await prisma.localReseller.findMany({
      where: {
        upazilla: {
          equals: upazillaReseller.upazilla,
          mode: "insensitive"
        }
      },
      include: {
        stock: {
          include: {
            sellerProduct: {
              include: {
                globalProduct: {
                  select: {
                    name: true,
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(localResellers);
  } catch (error: any) {
    console.error("Failed to fetch local resellers for monitor:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
