import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUpazillaCoords, getDistrictCoords } from "@/lib/aco-distance";

export async function GET() {
  try {
    const demandPheromonesRaw = await prisma.demandPheromone.findMany();
    const routePheromonesRaw = await prisma.routePheromone.findMany();

    const demandPheromones = demandPheromonesRaw.map((p) => {
      let coords = { lat: 0, lng: 0 };
      if (p.entityType === "upazilla") {
        coords = getUpazillaCoords(p.entityName);
      } else {
        coords = getDistrictCoords(p.entityName);
      }

      return {
        id: p.id,
        entityType: p.entityType,
        entityName: p.entityName,
        productName: p.productName,
        score: p.score,
        demandDeficit: p.demandDeficit,
        lat: coords.lat,
        lng: coords.lng,
        updatedAt: p.lastUpdated,
      };
    });

    const routePheromones = routePheromonesRaw.map((r) => {
      // routePheromones fromEntity and toEntity could be district or upazilla
      // Currently our logic creates fromEntity as upazilla/district name, and toEntity as upazilla/district name
      // We will try upazilla first, then district
      let fromCoords = getUpazillaCoords(r.fromEntity);
      if (fromCoords.lat === 23.6850 && fromCoords.lng === 90.3563) { // Default center check
        const dc = getDistrictCoords(r.fromEntity);
        if (dc.lat !== 23.6850 || dc.lng !== 90.3563) fromCoords = dc;
      }

      let toCoords = getUpazillaCoords(r.toEntity);
      if (toCoords.lat === 23.6850 && toCoords.lng === 90.3563) {
        const dc = getDistrictCoords(r.toEntity);
        if (dc.lat !== 23.6850 || dc.lng !== 90.3563) toCoords = dc;
      }

      return {
        id: r.id,
        fromEntity: r.fromEntity,
        toEntity: r.toEntity,
        productName: r.productName,
        score: r.score,
        successCount: r.successCount,
        totalRouted: r.totalRouted,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
      };
    });

    const allScores = [...demandPheromones].sort((a, b) => b.score - a.score);
    const hotspots = allScores.slice(0, 10);
    const coldspots = [...allScores].reverse().slice(0, 10);
    const totalDeficit = demandPheromones.reduce((sum, p) => sum + p.demandDeficit, 0);

    return NextResponse.json({
      demandPheromones,
      routePheromones,
      summary: {
        hotspots,
        coldspots,
        totalDeficit,
      },
    });
  } catch (error: any) {
    console.error("Fetch Pheromones Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pheromone data" },
      { status: 500 }
    );
  }
}
