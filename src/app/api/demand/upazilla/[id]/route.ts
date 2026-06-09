import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

async function verifyDemandAuthority(userId: string, upazillaResellerId: string) {
  if (userId === upazillaResellerId) return true;
  
  const upazillaReseller = await prisma.upazillaReseller.findUnique({
    where: { id: upazillaResellerId }
  });
  if (!upazillaReseller) return false;

  const districtReseller = await prisma.districtReseller.findUnique({
    where: { id: userId },
  });
  
  if (districtReseller) {
    const isMatched = UPAZILLAS.some(
      (u) => u.district === districtReseller.district && u.upazilla === upazillaReseller.upazilla
    );
    if (isMatched) return true;
  }
  return false;
}

async function recalculateDistrictDemand(upazillaResellerId: string, productName: string) {
  const upazillaReseller = await prisma.upazillaReseller.findUnique({
    where: { id: upazillaResellerId },
  });
  if (!upazillaReseller) return null;

  const upazillaInfo = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
  if (!upazillaInfo) return null;

  const districtReseller = await prisma.districtReseller.findUnique({
    where: { district: upazillaInfo.district },
  });

  if (!districtReseller) return null;

  const upazillasInDistrict = UPAZILLAS.filter((u) => u.district === districtReseller.district).map(u => u.upazilla);
  const allUpazillaResellersInDistrict = await prisma.upazillaReseller.findMany({
    where: { upazilla: { in: upazillasInDistrict } },
    select: { id: true },
  });
  const resellerIds = allUpazillaResellersInDistrict.map((r) => r.id);

  const aggregate = await prisma.upazillaDemand.aggregate({
    where: {
      upazillaResellerId: { in: resellerIds },
      productName,
    },
    _sum: {
      demandQuantity: true,
      fulfilledQuantity: true,
    },
  });

  const totalDemand = aggregate._sum.demandQuantity || 0;
  const totalFulfilled = aggregate._sum.fulfilledQuantity || 0;
  const remainingDemand = totalDemand - totalFulfilled;

  return await prisma.districtDemand.upsert({
    where: {
      districtResellerId_productName: {
        districtResellerId: districtReseller.id,
        productName,
      },
    },
    update: {
      totalDemand,
      remainingDemand,
    },
    create: {
      districtResellerId: districtReseller.id,
      productName,
      totalDemand,
      remainingDemand,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const resolvedParams = await params;
    const demandId = resolvedParams.id;
    const body = await req.json();
    const { demandQuantity, notes, status } = body;

    const demand = await prisma.upazillaDemand.findUnique({
      where: { id: demandId }
    });

    if (!demand) {
      return NextResponse.json({ error: "Demand not found" }, { status: 404 });
    }

    const isAuthorized = await verifyDemandAuthority(user.id, demand.upazillaResellerId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updates: any = {};

    if (demandQuantity !== undefined) {
      if (!Number.isInteger(demandQuantity) || demandQuantity < 1 || demandQuantity > 100000) {
        return NextResponse.json({ error: "demandQuantity must be integer between 1 and 100000" }, { status: 400 });
      }
      if (demandQuantity < demand.fulfilledQuantity) {
        return NextResponse.json({ 
          error: `Cannot reduce demand below already fulfilled quantity (${demand.fulfilledQuantity}) — seller stock has already been reserved.` 
        }, { status: 400 });
      }
      updates.demandQuantity = demandQuantity;
    }

    if (status !== undefined) {
      if (!["pending", "partially_fulfilled", "fulfilled"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (status === "fulfilled") {
        const targetQuantity = demandQuantity !== undefined ? demandQuantity : demand.demandQuantity;
        if (demand.fulfilledQuantity < targetQuantity) {
          return NextResponse.json({ 
            error: `Cannot mark fulfilled. Only ${demand.fulfilledQuantity} of ${targetQuantity} units have been reserved from seller stock.` 
          }, { status: 400 });
        }
      }
      updates.status = status;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    const updatedDemand = await prisma.upazillaDemand.update({
      where: { id: demandId },
      data: updates
    });

    // Recalculate district demand if demandQuantity changed
    if (demandQuantity !== undefined && demandQuantity !== demand.demandQuantity) {
      await recalculateDistrictDemand(demand.upazillaResellerId, demand.productName);
    }

    return NextResponse.json(updatedDemand);
  } catch (error: any) {
    console.error("Upazilla demand PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const resolvedParams = await params;
    const demandId = resolvedParams.id;

    const demand = await prisma.upazillaDemand.findUnique({
      where: { id: demandId }
    });

    if (!demand) {
      return NextResponse.json({ error: "Demand not found" }, { status: 404 });
    }

    const isAuthorized = await verifyDemandAuthority(user.id, demand.upazillaResellerId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (demand.fulfilledQuantity > 0) {
      return NextResponse.json({ 
        error: "Cannot delete demand that has already been partially fulfilled from seller stock. Reset fulfilledQuantity first." 
      }, { status: 400 });
    }

    if (demand.status === "fulfilled") {
      return NextResponse.json({ 
        error: "Cannot delete a fulfilled demand." 
      }, { status: 400 });
    }

    await prisma.upazillaDemand.delete({
      where: { id: demandId }
    });

    await recalculateDistrictDemand(demand.upazillaResellerId, demand.productName);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Upazilla demand DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
