import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getUpazilasForDistrict } from "@/data/upazillas";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const districtReseller = await prisma.districtReseller.findUnique({
      where: { id: user.id }
    });

    if (!districtReseller) {
      return NextResponse.json({ error: "District reseller not found" }, { status: 404 });
    }

    const upazillaNames = getUpazilasForDistrict(districtReseller.district);

    const upazillaResellers = await prisma.upazillaReseller.findMany({
      where: { upazilla: { in: upazillaNames } },
      select: { id: true, upazilla: true, email: true }
    });

    const upazillaResellerIds = upazillaResellers.map(r => r.id);
    const upazillaMap = new Map(upazillaResellers.map(r => [r.id, r]));

    const allStock = await prisma.upazillaAvailableStock.findMany({
      where: {
        upazillaResellerId: { in: upazillaResellerIds },
        isVisibleToDistrict: true,
        availableQty: { gt: 0 }
      },
      include: {
        upazillaReseller: {
          select: {
            upazilla: true,
            email: true
          }
        }
      }
    });

    const byProduct: Record<string, any> = {};

    for (const item of allStock) {
      const name = item.productName;
      if (!byProduct[name]) {
        byProduct[name] = {
          totalAvailable: 0,
          priceRange: { min: item.pricePerUnit, max: item.pricePerUnit },
          sources: []
        };
      }

      const productGroup = byProduct[name];
      productGroup.totalAvailable += item.availableQty;
      
      if (item.pricePerUnit < productGroup.priceRange.min) productGroup.priceRange.min = item.pricePerUnit;
      if (item.pricePerUnit > productGroup.priceRange.max) productGroup.priceRange.max = item.pricePerUnit;

      productGroup.sources.push({
        id: item.id,
        upazilla: item.upazillaReseller.upazilla,
        availableQty: item.availableQty,
        pricePerUnit: item.pricePerUnit,
        productCode: item.productCode,
        upazillaEmail: item.upazillaReseller.email
      });
    }

    return NextResponse.json({
      byProduct,
      allStock
    });

  } catch (error: any) {
    console.error("Failed to fetch upazilla available stock for district:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
