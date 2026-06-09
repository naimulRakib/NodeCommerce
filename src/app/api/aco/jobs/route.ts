import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const productName = searchParams.get("productName");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Determine user's role and scope
    // We can query to see what kind of profile they have
    const isSeller = await prisma.profile.findUnique({ where: { id: user.id } });
    const isUpazillaReseller = await prisma.upazillaReseller.findUnique({ where: { id: user.id } });
    const isDistrictReseller = await prisma.districtReseller.findUnique({ where: { id: user.id } });

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }
    if (productName) {
      whereClause.productScope = { has: productName };
    }

    if (isSeller) {
      whereClause.sellerProduct = { sellerId: user.id };
    } else if (isUpazillaReseller) {
      // Jobs that affect this upazilla (either from local sellers, or allocations to this upazilla)
      whereClause.OR = [
        { sellerProduct: { seller: { upazilla: isUpazillaReseller.upazilla } } },
        { acoallocations: { some: { toId: isUpazillaReseller.id } } }
      ];
    } else if (isDistrictReseller) {
      // Jobs in their district or targeted to their district
      whereClause.OR = [
        { sellerProduct: { seller: { city: isDistrictReseller.district } } },
        { interDistrictOpportunities: { some: { OR: [{ sourceDistrictId: isDistrictReseller.id }, { targetDistrictId: isDistrictReseller.id }] } } }
      ];
    } else {
      // Super admin or buyer? If buyer, unauthorized
      return NextResponse.json({ error: "Unauthorized access to ACO jobs" }, { status: 403 });
    }

    const jobs = await prisma.aCORoutingJob.findMany({
      where: whereClause,
      include: {
        acoallocations: true,
        interDistrictOpportunities: true,
        sellerProduct: {
          select: {
            customName: true,
            globalProduct: { select: { name: true } }
          }
        }
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.aCORoutingJob.count({ where: whereClause });

    return NextResponse.json({
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Fetch ACO Jobs Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
