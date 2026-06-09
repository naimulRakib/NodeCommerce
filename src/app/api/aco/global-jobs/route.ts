
/**
 * GET /api/aco/global-jobs
 *
 * List ACOGlobalJob rows in reverse-chronological order.
 * The SuperDashboard polls this for the recent-runs list.
 *
 * Query params:
 *   - limit: int (default 20, max 100)
 *   - status: optional filter
 *   - includeShipments: bool (default false) — when true,
 *     the response includes the full shipment tree with
 *     line items. Use sparingly; large responses.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.max(1, Math.min(100, isNaN(limitRaw) ? 20 : limitRaw));
  const status = url.searchParams.get("status") ?? undefined;
  const includeShipments =
    url.searchParams.get("includeShipments") === "true";

  const where: any = {};
  if (status) where.status = status;

  const jobs = await prisma.aCOGlobalJob.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: includeShipments
      ? {
          shipments: {
            include: { lineItems: true },
            orderBy: { createdAt: "asc" },
          },
        }
      : {
          _count: { select: { shipments: true } },
        },
  });

  return NextResponse.json({
    ok: true,
    count: jobs.length,
    jobs: jobs.map((j) => ({
      id: j.id,
      triggeredBy: j.triggeredBy,
      triggerType: j.triggerType,
      sourceDistrict: j.sourceDistrict,
      productScope: j.productScope,
      status: j.status,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      errorMessage: j.errorMessage,
      totalSupply: j.totalSupply,
      totalDemand: j.totalDemand,
      phase1Summary: j.phase1Summary,
      phase2Summary: j.phase2Summary,
      phase3Summary: j.phase3Summary,
      phase4Summary: j.phase4Summary,
      conservationCheck: j.conservationCheck,
      shipmentCount: includeShipments
        ? (j as any).shipments?.length
        : (j as any)._count?.shipments,
      shipments: includeShipments ? (j as any).shipments : undefined,
    })),
  });
}
