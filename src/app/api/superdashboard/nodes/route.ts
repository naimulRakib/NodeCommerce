import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
// @ts-ignore
import UPAZILLA_CENTROIDS_RAW from "@/data/upazilla-centroids.js";
// @ts-ignore
import DISTRICT_CENTROIDS_RAW from "@/data/district-centroids.js";

const UPAZILLA_CENTROIDS = UPAZILLA_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;
const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

// Build normalized maps for fast lookups
const normalizedUpazillaCentroids: Record<string, { lat: number; lng: number }> = {};
Object.entries(UPAZILLA_CENTROIDS).forEach(([key, val]) => {
  normalizedUpazillaCentroids[key.toLowerCase().trim()] = val;
});

const normalizedDistrictCentroids: Record<string, { lat: number; lng: number }> = {};
Object.entries(DISTRICT_CENTROIDS).forEach(([key, val]) => {
  normalizedDistrictCentroids[key.toLowerCase().trim()] = val;
});

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 1. Fetch Sellers (Profile where type = "seller")
    const rawSellers = await prisma.profile.findMany({
      where: {
        type: "seller",
      },
      take: 2000,
      select: {
        id: true,
        storeName: true,
        lat: true,
        lng: true,
        city: true,
        upazilla: true,
        createdAt: true,
      },
    });

    const sellers = rawSellers
      .map((s) => {
        let lat = s.lat;
        let lng = s.lng;
        
        // Fallback if coordinates are 0 (default) or missing
        if (!lat && !lng) {
          const upazillaKey = s.upazilla ? s.upazilla.toLowerCase().trim() : "";
          const districtKey = s.city ? s.city.toLowerCase().trim() : "";
          
          const coords = normalizedUpazillaCentroids[upazillaKey] || normalizedDistrictCentroids[districtKey];
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }
        
        if (!lat && !lng) return null; // Still nothing, drop them

        return {
          id: s.id,
          name: s.storeName,
          lat,
          lng,
          city: s.city,
          upazilla: s.upazilla,
          type: "seller" as const,
          createdAt: s.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 2. Fetch Local Resellers
    const rawLocal = await prisma.localReseller.findMany({
      select: {
        id: true,
        username: true,
        lat: true,
        lng: true,
        city: true,
        upazilla: true,
        createdAt: true,
      },
    });

    const localResellers = rawLocal
      .map((lr) => {
        let lat = lr.lat;
        let lng = lr.lng;
        
        // Fallback if coordinates are 0 or missing
        if (!lat && !lng) {
          const upazillaKey = lr.upazilla ? lr.upazilla.toLowerCase().trim() : "";
          const districtKey = lr.city ? lr.city.toLowerCase().trim() : "";
          
          const coords = normalizedUpazillaCentroids[upazillaKey] || normalizedDistrictCentroids[districtKey];
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }
        
        if (!lat && !lng) return null;

        return {
          id: lr.id,
          name: lr.username,
          lat,
          lng,
          city: lr.city,
          upazilla: lr.upazilla,
          type: "local_reseller" as const,
          createdAt: lr.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 3. Fetch Upazilla Resellers
    const rawUpazilla = await prisma.upazillaReseller.findMany({
      select: {
        id: true,
        email: true,
        city: true,
        upazilla: true,
        createdAt: true,
      },
    });

    const upazillaResellers = rawUpazilla
      .map((ur) => {
        const lookupKey = ur.upazilla ? ur.upazilla.toLowerCase().trim() : "";
        let coords = normalizedUpazillaCentroids[lookupKey];
        
        // Fallback to district centroid if upazilla centroid is missing
        if (!coords) {
          const districtKey = ur.city ? ur.city.toLowerCase().trim() : "";
          coords = normalizedDistrictCentroids[districtKey];
        }
        
        if (!coords) return null;
        return {
          id: ur.id,
          name: ur.email,
          lat: coords.lat,
          lng: coords.lng,
          upazilla: ur.upazilla,
          city: ur.city,
          type: "upazilla_reseller" as const,
          createdAt: ur.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 4. Fetch District Resellers
    const rawDistrict = await prisma.districtReseller.findMany({
      select: {
        id: true,
        email: true,
        district: true,
        createdAt: true,
      },
    });

    const districtResellers = rawDistrict
      .map((dr) => {
        const lookupKey = dr.district ? dr.district.toLowerCase().trim() : "";
        const coords = normalizedDistrictCentroids[lookupKey];
        if (!coords) return null;
        return {
          id: dr.id,
          name: dr.email,
          lat: coords.lat,
          lng: coords.lng,
          district: dr.district,
          type: "district_reseller" as const,
          createdAt: dr.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Summary Statistics
    const summary = {
      totalSellers: sellers.length,
      totalLocalResellers: localResellers.length,
      totalUpazillaResellers: upazillaResellers.length,
      totalDistrictResellers: districtResellers.length,
      totalNodes:
        sellers.length +
        localResellers.length +
        upazillaResellers.length +
        districtResellers.length,
    };

    return NextResponse.json(
      {
        sellers,
        localResellers,
        upazillaResellers,
        districtResellers,
        summary,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60",
        },
      }
    );
  } catch (error: any) {
    console.error("SuperDashboard Nodes API Error:", error);
    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : String(error)) ||
          "Internal server error",
      },
      { status: 500 }
    );
  }
}
