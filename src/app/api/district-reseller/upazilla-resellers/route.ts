import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });

    if (!districtReseller) {
      return NextResponse.json({ error: "District Reseller profile not found" }, { status: 404 });
    }

    const district = districtReseller.district;

    const districtUpazillas = UPAZILLAS
      .filter((u) => u.district === district)
      .map((u) => u.upazilla);

    const upazillaResellers = await prisma.upazillaReseller.findMany({
      where: {
        upazilla: {
          in: districtUpazillas
        }
      },
      include: {
        inventory: true,
        demands: true
      }
    });

    return NextResponse.json({ upazillaResellers, district });
  } catch (error: any) {
    console.error("Failed to fetch upazilla resellers:", error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
  }
}
