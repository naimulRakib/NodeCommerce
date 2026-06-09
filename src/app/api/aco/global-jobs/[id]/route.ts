
/**
 * GET /api/aco/global-jobs/[id]
 *
 * Detail view of a single ACOGlobalJob. Returns the full
 * shipment tree, line items, and conservation report. The
 * SuperDashboard detail modal uses this.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const job = await prisma.aCOGlobalJob.findUnique({
    where: { id },
    include: {
      shipments: {
        include: { lineItems: true },
        orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Pull the snapshots so the UI can show "what the
  // engine saw at trigger time" alongside "what it
  // decided to do".
  const [demandSnaps, supplySnaps] = await Promise.all([
    prisma.productDemandSnapshot.findMany({
      where: { jobId: id },
      orderBy: [{ productName: "asc" }, { scope: "asc" }],
    }),
    prisma.sellerSupplySnapshot.findMany({
      where: { jobId: id },
      orderBy: [{ productName: "asc" }, { sellerId: "asc" }],
    }),
  ]);

  return NextResponse.json({
    ok: true,
    job: {
      ...job,
      demandSnapshots: demandSnaps,
      supplySnapshots: supplySnaps,
    },
  });
}
