import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const resolvedParams = await params;
    const demandId = resolvedParams.id;
    const body = await req.json();
    const { totalDemand } = body;

    if (totalDemand === undefined) {
      return NextResponse.json({ error: "totalDemand is required" }, { status: 400 });
    }

    if (!Number.isInteger(totalDemand) || totalDemand < 0) {
      return NextResponse.json({ error: "totalDemand must be integer >= 0" }, { status: 400 });
    }
    if (totalDemand > 1000000) {
      return NextResponse.json({ error: "totalDemand must not exceed 1000000" }, { status: 400 });
    }

    const districtDemand = await prisma.districtDemand.findUnique({
      where: { id: demandId }
    });

    if (!districtDemand) {
      return NextResponse.json({ error: "District Demand not found" }, { status: 404 });
    }

    if (districtDemand.districtResellerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });

    if (!districtReseller) {
      return NextResponse.json({ error: "District Reseller not found" }, { status: 404 });
    }

    // Sum all upazilla demands for this product in this district
    const upazillasInDistrict = UPAZILLAS.filter((u) => u.district === districtReseller.district).map(u => u.upazilla);
    const upazillaResellers = await prisma.upazillaReseller.findMany({
      where: { upazilla: { in: upazillasInDistrict } },
      select: { id: true }
    });
    const resellerIds = upazillaResellers.map((r) => r.id);

    const aggregate = await prisma.upazillaDemand.aggregate({
      where: {
        upazillaResellerId: { in: resellerIds },
        productName: districtDemand.productName
      },
      _sum: {
        demandQuantity: true,
        fulfilledQuantity: true
      }
    });

    const sumUpazillaDemand = aggregate._sum.demandQuantity || 0;
    const totalFulfilled = aggregate._sum.fulfilledQuantity || 0;

    if (totalDemand < sumUpazillaDemand) {
      return NextResponse.json({ 
        error: `District demand cannot be less than combined upazilla demands (${sumUpazillaDemand} units already entered)` 
      }, { status: 400 });
    }

    // Also check against fulfilledByUpazillas in DistrictStockItem if it exists
    const stockItem = await prisma.districtStockItem.findFirst({
      where: {
        districtResellerId: user.id,
        productName: districtDemand.productName
      }
    });

    const fulfilledByUpazillas = stockItem?.fulfilledByUpazillas || 0;
    const maxFulfilled = Math.max(totalFulfilled, fulfilledByUpazillas);

    if (totalDemand < maxFulfilled) {
      return NextResponse.json({ 
        error: `Cannot reduce totalDemand below currently fulfilled quantity (${maxFulfilled})` 
      }, { status: 400 });
    }

    const remainingDemand = totalDemand - maxFulfilled;

    const updatedDistrictDemand = await prisma.districtDemand.update({
      where: { id: demandId },
      data: {
        totalDemand,
        remainingDemand
      }
    });

    return NextResponse.json(updatedDistrictDemand);

  } catch (error: any) {
    console.error("District demand PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
