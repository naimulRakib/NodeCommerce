import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    // Fetch all stock items from OTHER districts where surplus > 0
    const otherDistrictsStock = await prisma.districtStockItem.findMany({
      where: {
        districtResellerId: { not: user.id }
      },
      include: {
        districtReseller: {
          select: { district: true, email: true }
        }
      }
    });

    const otherDistrictsDemand = await prisma.districtDemand.findMany({
      where: {
        districtResellerId: { not: user.id }
      }
    });

    // Calculate surplus
    const surplusItems = otherDistrictsStock.map(stock => {
      const demand = otherDistrictsDemand.find(d => 
        d.districtResellerId === stock.districtResellerId && 
        d.productName.toLowerCase() === stock.productName.toLowerCase()
      );
      
      const surplus = Math.max(0, stock.quantity - (demand?.remainingDemand ?? 0));
      return {
        ...stock,
        surplusAvailable: surplus
      };
    }).filter(item => item.surplusAvailable > 0);

    return NextResponse.json(surplusItems);
  } catch (error: any) {
    console.error("Failed to fetch national surplus:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
