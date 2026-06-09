import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const job = await prisma.aCORoutingJob.findUnique({
      where: { id },
      include: {
        acoallocations: {
          orderBy: { phase: 'asc' }
        },
        interDistrictOpportunities: {
          include: {
            sourceDist: true,
            targetDist: true
          }
        },
        sellerProduct: {
          include: {
            seller: { select: { storeName: true, upazilla: true, city: true } },
            globalProduct: { select: { name: true, category: true } }
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Role-based access control can be added here if needed to restrict visibility.
    // For now, if they are authenticated, let them see job details.

    return NextResponse.json(job);
  } catch (error: any) {
    console.error("Fetch ACO Job Details Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job details" },
      { status: 500 }
    );
  }
}
