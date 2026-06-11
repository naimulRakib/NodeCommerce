import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/aco/shipment-routes?jobId=xxx
 * Returns ACOShipment rows for a job with resolved lat/lng for animation.
 */
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const shipments = await prisma.aCOShipment.findMany({
      where: { jobId },
      include: { job: { select: { sourceDistrict: true } } },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
    });

    // Resolve lat/lng for each from/to node
    const [sellers, upazillas, districts] = await Promise.all([
      prisma.profile.findMany({ select: { id: true, lat: true, lng: true, storeName: true, city: true, upazilla: true } }),
      prisma.upazillaReseller.findMany({ select: { id: true, lat: true, lng: true, city: true, upazilla: true } }),
      prisma.districtReseller.findMany({ select: { id: true, lat: true, lng: true, district: true } }),
    ]);

    const sellerMap = new Map(sellers.map(s => [s.id, s]));
    const upazillaMap = new Map(upazillas.map(u => [u.id, u]));
    const districtMap = new Map(districts.map(d => [d.id, d]));

    const resolved = shipments.map((s) => {
      // Resolve from-node coords
      let fromLat = 23.685, fromLng = 90.356;
      let fromLabel = s.fromName;
      if (s.fromType === "seller") {
        const seller = sellerMap.get(s.fromId);
        if (seller) { fromLat = seller.lat; fromLng = seller.lng; fromLabel = seller.storeName || seller.city; }
      } else if (s.fromType === "district_hub" || s.fromType === "district") {
        const dist = districtMap.get(s.fromId);
        if (dist) { fromLat = dist.lat ?? 23.685; fromLng = dist.lng ?? 90.356; fromLabel = dist.district; }
      }

      // Resolve to-node coords
      let toLat = 23.685, toLng = 90.356;
      let toLabel = s.toName;
      if (s.toType === "upazilla" || s.toType === "upazilla_reseller") {
        const uz = upazillaMap.get(s.toId);
        if (uz) { toLat = uz.lat ?? 23.685; toLng = uz.lng ?? 90.356; toLabel = `${uz.upazilla} Hub`; }
      } else if (s.toType === "district_hub") {
        const dist = districtMap.get(s.toId);
        if (dist) { toLat = dist.lat ?? 23.685; toLng = dist.lng ?? 90.356; toLabel = `${dist.district} District Hub`; }
      }

      return {
        id: s.id,
        phase: s.phase,
        fromLat,
        fromLng,
        fromName: fromLabel,
        fromType: s.fromType,
        toLat,
        toLng,
        toName: toLabel,
        toType: s.toType,
        totalQuantity: s.totalQuantity,
        status: s.status,
        products: (s as any).items ?? [],
      };
    });

    return NextResponse.json({ shipments: resolved });
  } catch (err: any) {
    console.error("[shipment-routes]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
