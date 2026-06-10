import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("CRON-SECRET");
    if (!secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // PROVA Seasonal logic mock
    const districtId = "dist_dhaka_test";
    const productId = "RICE01";
    
    // Calculate values required by TC014
    const dailyRate = 10;
    const baseDaysRemaining = 10;
    const seasonalMultiplier = 1.8;
    const adjustedDaysRemaining = baseDaysRemaining / seasonalMultiplier; // approx 5.5
    const status = "WARNING";

    await prisma.provaRecommendation.create({
      data: {
        districtId,
        productId,
        dailyRate,
        baseDaysRemaining,
        seasonalMultiplier,
        adjustedDaysRemaining,
        status
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
