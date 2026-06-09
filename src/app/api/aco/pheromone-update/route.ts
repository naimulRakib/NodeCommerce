import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computePheromoneUpdates } from "@/lib/aco-engine";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("X-Cron-Secret");
    if (authHeader !== process.env.CRON_SECRET) {
      // In dev environment or if CRON_SECRET is not set, we might bypass this for testing
      // but strictly adhering to instructions:
      if (process.env.NODE_ENV === "production" || process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
      }
    }

    // EDGE CASE 66: Concurrency Lock
    const activeJobs = await prisma.aCORoutingJob.count({
      where: { status: "running" }
    });
    
    if (activeJobs > 0) {
      return NextResponse.json(
        { error: "Cannot update pheromones while ACO jobs are actively running." },
        { status: 409 }
      );
    }
    // EDGE CASE 29: Prevent double evaporation / accumulation in the same day
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const alreadyUpdated = await prisma.demandPheromone.findFirst({
      where: {
        lastUpdated: { gte: startOfToday }
      }
    });

    if (alreadyUpdated) {
      return NextResponse.json({ success: true, message: "Already updated today" });
    }

    let updatedCount = 0;

    // 1. Process Upazilla Demands
    const activeUpazillaDemands = await prisma.upazillaDemand.findMany({
      where: { status: { not: "fulfilled" } },
      include: { upazillaReseller: true }
    });

    for (const d of activeUpazillaDemands) {
      const waitingDays = Math.floor(
        (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const demandDeficit = d.demandQuantity - d.fulfilledQuantity;

      const existing = await prisma.demandPheromone.findFirst({
        where: {
          entityType: "upazilla",
          entityId: d.upazillaResellerId,
          productName: d.productName,
        }
      });

      const existingScore = existing?.score ?? 1.0;
      const newScore = computePheromoneUpdates({
        existingScore,
        demandDeficit,
        waitingDays: waitingDays < 0 ? 0 : waitingDays,
        wasRouted: false
      });

      if (existing) {
        await prisma.demandPheromone.update({
          where: { id: existing.id },
          data: {
            score: newScore,
            demandDeficit,
            waitingDays: waitingDays < 0 ? 0 : waitingDays
          }
        });
      } else {
        await prisma.demandPheromone.create({
          data: {
            entityType: "upazilla",
            entityId: d.upazillaResellerId,
            entityName: d.upazillaReseller.upazilla,
            productName: d.productName,
            score: newScore,
            demandDeficit,
            waitingDays: waitingDays < 0 ? 0 : waitingDays
          }
        });
      }
      updatedCount++;
    }

    // 2. Process District Demands
    const activeDistrictDemands = await prisma.districtDemand.findMany({
      where: { status: { not: "fulfilled" } },
      include: { districtReseller: true }
    });

    for (const d of activeDistrictDemands) {
      const waitingDays = Math.floor(
        (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const demandDeficit = d.remainingDemand;

      const existing = await prisma.demandPheromone.findFirst({
        where: {
          entityType: "district",
          entityId: d.districtResellerId,
          productName: d.productName,
        }
      });

      const existingScore = existing?.score ?? 1.0;
      const newScore = computePheromoneUpdates({
        existingScore,
        demandDeficit,
        waitingDays: waitingDays < 0 ? 0 : waitingDays,
        wasRouted: false
      });

      if (existing) {
        await prisma.demandPheromone.update({
          where: { id: existing.id },
          data: {
            score: newScore,
            demandDeficit,
            waitingDays: waitingDays < 0 ? 0 : waitingDays
          }
        });
      } else {
        await prisma.demandPheromone.create({
          data: {
            entityType: "district",
            entityId: d.districtResellerId,
            entityName: d.districtReseller.district,
            productName: d.productName,
            score: newScore,
            demandDeficit,
            waitingDays: waitingDays < 0 ? 0 : waitingDays
          }
        });
      }
      updatedCount++;
    }

    // 3. Process Fulfilled Demands (Evaporate)
    // Upazilla fulfilled
    const fulfilledUpazillaDemands = await prisma.upazillaDemand.findMany({
      where: { status: "fulfilled" }
    });
    for (const d of fulfilledUpazillaDemands) {
      const existing = await prisma.demandPheromone.findFirst({
        where: {
          entityType: "upazilla",
          entityId: d.upazillaResellerId,
          productName: d.productName,
        }
      });
      if (existing && existing.score > 0.1) {
        await prisma.demandPheromone.update({
          where: { id: existing.id },
          data: {
            score: computePheromoneUpdates({
              existingScore: existing.score,
              demandDeficit: 0,
              waitingDays: 0,
              wasRouted: true // Treat fulfilled evaporation identically to wasRouted decay
            }),
            demandDeficit: 0
          }
        });
        updatedCount++;
      }
    }

    // District fulfilled
    const fulfilledDistrictDemands = await prisma.districtDemand.findMany({
      where: { status: "fulfilled" }
    });
    for (const d of fulfilledDistrictDemands) {
      const existing = await prisma.demandPheromone.findFirst({
        where: {
          entityType: "district",
          entityId: d.districtResellerId,
          productName: d.productName,
        }
      });
      if (existing && existing.score > 0.1) {
        await prisma.demandPheromone.update({
          where: { id: existing.id },
          data: {
            score: computePheromoneUpdates({
              existingScore: existing.score,
              demandDeficit: 0,
              waitingDays: 0,
              wasRouted: true
            }),
            demandDeficit: 0
          }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Pheromone Update Error:", error);
    return NextResponse.json(
      { error: "Failed to run pheromone update job" },
      { status: 500 }
    );
  }
}
