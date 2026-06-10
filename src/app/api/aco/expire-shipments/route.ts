import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Only allow cron job or admins to trigger this (basic secret check)
    const secret = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 8 hours ago
    const cutoffDate = new Date(Date.now() - 8 * 60 * 60 * 1000);

    const expiredShipments = await prisma.aCOShipment.findMany({
      where: {
        phase: 3,
        status: "pending_approval",
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (expiredShipments.length === 0) {
      return NextResponse.json({ success: true, expiredCount: 0, message: "No hanging shipments found." });
    }

    const ids = expiredShipments.map(s => s.id);

    const result = await prisma.aCOShipment.updateMany({
      where: {
        id: { in: ids },
        status: "pending_approval", // Double check atomic condition
      },
      data: {
        status: "expired",
        failureReason: "uipath_job_timeout",
        notes: "Automatically expired after 8 hours pending_approval.",
      },
    });

    console.log(`[Sweeper] Auto-expired ${result.count} hanging shipments: ${ids.join(', ')}`);

    // In a real system, you might trigger an email alert to ops@nodecommerce.bd here.

    return NextResponse.json({ success: true, expiredCount: result.count, expiredIds: ids });
  } catch (error: any) {
    console.error("[Expire Shipments Hook] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
