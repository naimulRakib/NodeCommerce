import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const districtResellerId = searchParams.get("districtResellerId");

    if (!districtResellerId) {
      return NextResponse.json({ error: "districtResellerId query parameter is required" }, { status: 400 });
    }

    if (user.id !== districtResellerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: districtResellerId }
    });

    if (!districtReseller) {
      return NextResponse.json({ error: "District Reseller not found" }, { status: 404 });
    }

    const districtDemands = await prisma.districtDemand.findMany({
      where: { districtResellerId },
      orderBy: { productName: "asc" }
    });

    const upazillasInDistrict = UPAZILLAS.filter((u) => u.district === districtReseller.district).map(u => u.upazilla);
    
    const upazillaResellers = await prisma.upazillaReseller.findMany({
      where: { upazilla: { in: upazillasInDistrict } },
      select: { id: true, upazilla: true }
    });
    
    const resellerMap = new Map(upazillaResellers.map(r => [r.id, r.upazilla]));
    const resellerIds = upazillaResellers.map((r) => r.id);

    const upazillaDemands = await prisma.upazillaDemand.findMany({
      where: { upazillaResellerId: { in: resellerIds } }
    });

    const upazillaBreakdown: Record<string, any> = {};

    // Initialize products from districtDemands
    for (const dd of districtDemands) {
      upazillaBreakdown[dd.productName] = {
        totalDemand: dd.totalDemand,
        remainingDemand: dd.remainingDemand,
        upazillas: []
      };
    }

    // Populate upazillas
    for (const ud of upazillaDemands) {
      if (!upazillaBreakdown[ud.productName]) {
        // If there's an upazilla demand but no district demand, initialize it (should be rare due to auto-calc)
        upazillaBreakdown[ud.productName] = {
          totalDemand: 0,
          remainingDemand: 0,
          upazillas: []
        };
      }
      upazillaBreakdown[ud.productName].upazillas.push({
        upazilla: resellerMap.get(ud.upazillaResellerId) || "Unknown",
        demandQuantity: ud.demandQuantity,
        fulfilledQuantity: ud.fulfilledQuantity,
        status: ud.status
      });
      // Add to running total
      upazillaBreakdown[ud.productName].totalDemand += ud.demandQuantity;
    }

    // Inject virtual district demands if manual overrides don't exist
    for (const [productName, breakdown] of Object.entries(upazillaBreakdown)) {
      const exists = districtDemands.some(d => d.productName === productName);
      if (!exists) {
        districtDemands.push({
          id: `virtual-${productName}`,
          districtResellerId,
          productName,
          totalDemand: breakdown.totalDemand,
          remainingDemand: breakdown.totalDemand,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
      }
    }

    return NextResponse.json({
      districtDemands,
      upazillaBreakdown
    });

  } catch (error: any) {
    console.error("District demand GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const body = await req.json();
    let { productName, totalDemand } = body;

    if (!Number.isInteger(totalDemand) || totalDemand < 0) {
      return NextResponse.json({ error: "totalDemand must be integer >= 0" }, { status: 400 });
    }
    if (totalDemand > 1000000) {
      return NextResponse.json({ error: "totalDemand must not exceed 1000000" }, { status: 400 });
    }

    productName = productName ? productName.trim() : "";
    if (!productName) {
      return NextResponse.json({ error: "productName must not be empty string" }, { status: 400 });
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
        productName
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

    const remainingDemand = totalDemand - totalFulfilled;

    const updatedDistrictDemand = await prisma.districtDemand.upsert({
      where: {
        districtResellerId_productName: {
          districtResellerId: user.id,
          productName
        }
      },
      update: {
        totalDemand,
        remainingDemand
      },
      create: {
        districtResellerId: user.id,
        productName,
        totalDemand,
        remainingDemand
      }
    });

    return NextResponse.json(updatedDistrictDemand);

  } catch (error: any) {
    console.error("District demand POST error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
