import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UPAZILLAS } from "@/data/upazillas";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    let { upazillaResellerId, productName, demandQuantity, notes } = body;

    // VALIDATIONS
    if (!Number.isInteger(demandQuantity) || demandQuantity < 1) {
      return NextResponse.json({ error: "demandQuantity must be integer >= 1" }, { status: 400 });
    }
    if (demandQuantity > 100000) {
      return NextResponse.json({ error: "demandQuantity must not exceed 100000" }, { status: 400 });
    }

    productName = productName ? productName.trim() : "";
    if (!productName) {
      return NextResponse.json({ error: "productName must not be empty string" }, { status: 400 });
    }
    if (productName.length > 200) {
      return NextResponse.json({ error: "productName max 200 characters" }, { status: 400 });
    }

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: upazillaResellerId },
    });
    if (!upazillaReseller) {
      return NextResponse.json({ error: "Upazilla Reseller not found" }, { status: 400 });
    }

    // Verify ownership or district authority
    let isAuthorized = false;
    if (user.id === upazillaResellerId) {
      isAuthorized = true;
    } else {
      const districtReseller = await prisma.districtReseller.findUnique({
        where: { id: user.id },
      });
      if (districtReseller) {
        const isMatched = UPAZILLAS.some(
          (u) => u.district === districtReseller.district && u.upazilla === upazillaReseller.upazilla
        );
        if (isMatched) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized to enter demand for this upazilla" }, { status: 403 });
    }

    // Upsert UpazillaDemand
    const upazillaDemand = await prisma.upazillaDemand.upsert({
      where: {
        upazillaResellerId_productName: {
          upazillaResellerId,
          productName,
        },
      },
      update: {
        demandQuantity,
        notes: notes || null,
        fulfilledQuantity: 0,
        status: "pending",
        enteredBy: user.id,
      },
      create: {
        upazillaResellerId,
        productName,
        demandQuantity,
        notes: notes || null,
        enteredBy: user.id,
      },
    });

    // Recalculate DistrictDemand
    const upazillaInfo = UPAZILLAS.find((u) => u.upazilla === upazillaReseller.upazilla);
    let districtDemand = null;

    if (upazillaInfo) {
      const districtReseller = await prisma.districtReseller.findUnique({
        where: { district: upazillaInfo.district },
      });

      if (districtReseller) {
        // Find all upazilla resellers in this district
        const upazillasInDistrict = UPAZILLAS.filter((u) => u.district === districtReseller.district).map(u => u.upazilla);
        
        const allUpazillaResellersInDistrict = await prisma.upazillaReseller.findMany({
          where: { upazilla: { in: upazillasInDistrict } },
          select: { id: true },
        });
        const resellerIds = allUpazillaResellersInDistrict.map((r) => r.id);

        // Sum demand mapping
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

        districtDemand = await prisma.districtDemand.upsert({
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
    }

    return NextResponse.json({ upazillaDemand, districtDemand });
  } catch (error: any) {
    console.error("Upazilla demand POST error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const upazillaResellerId = searchParams.get("upazillaResellerId");

    if (!upazillaResellerId) {
      return NextResponse.json({ error: "upazillaResellerId query parameter is required" }, { status: 400 });
    }

    const upazillaReseller = await prisma.upazillaReseller.findUnique({
      where: { id: upazillaResellerId },
    });
    if (!upazillaReseller) {
      return NextResponse.json({ error: "Upazilla Reseller not found" }, { status: 404 });
    }

    // Verify ownership or district authority
    let isAuthorized = false;
    if (user.id === upazillaResellerId) {
      isAuthorized = true;
    } else {
      const districtReseller = await prisma.districtReseller.findUnique({
        where: { id: user.id },
      });
      if (districtReseller) {
        const isMatched = UPAZILLAS.some(
          (u) => u.district === districtReseller.district && u.upazilla === upazillaReseller.upazilla
        );
        if (isMatched) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized to view demand for this upazilla" }, { status: 403 });
    }

    // Fetch all upazilla-level demands
    const demands = await prisma.upazillaDemand.findMany({
      where: { upazillaResellerId },
      orderBy: { productName: "asc" },
    });

    // Fetch all local resellers registered under this upazilla
    const localResellers = await prisma.localReseller.findMany({
      where: { upazilla: upazillaReseller.upazilla },
      select: { id: true, username: true, resellerCode: true },
    });

    const localResellerIds = localResellers.map((lr) => lr.id);
    const localResellerMap = new Map(localResellers.map((lr) => [lr.id, lr]));

    // Fetch all local demands from resellers in this upazilla
    const localDemands = localResellerIds.length > 0
      ? await prisma.localDemand.findMany({
          where: { localResellerId: { in: localResellerIds } },
          orderBy: { productName: "asc" },
        })
      : [];

    // Build per-product breakdown: productName → list of local reseller contributions
    const localBreakdown = new Map<string, Array<{
      localResellerId: string;
      storeName: string;
      resellerCode: string;
      demandQuantity: number;
      fulfilledQuantity: number;
      status: string;
    }>>();

    for (const ld of localDemands) {
      const reseller = localResellerMap.get(ld.localResellerId);
      if (!reseller) continue;
      const key = ld.productName.toLowerCase();
      if (!localBreakdown.has(key)) localBreakdown.set(key, []);
      localBreakdown.get(key)!.push({
        localResellerId: ld.localResellerId,
        storeName: reseller.username,
        resellerCode: reseller.resellerCode,
        demandQuantity: ld.demandQuantity,
        fulfilledQuantity: ld.fulfilledQuantity,
        status: ld.status,
      });
    }

    // Attach local breakdown + ACO fulfillment flag to each demand row
    const enriched = demands.map((d) => ({
      ...d,
      // localContributors: which local resellers drove this upazilla demand
      localContributors: localBreakdown.get(d.productName.toLowerCase()) ?? [],
      // acoFulfilled: true means the ACO pipeline already delivered stock for this
      // demand. The demand row is "fulfilled" from the supply chain perspective,
      // NOT because the local resellers got their goods — that happens at delivery.
      acoFulfilled: d.fulfilledQuantity >= d.demandQuantity && d.demandQuantity > 0,
    }));

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("Upazilla demand GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
