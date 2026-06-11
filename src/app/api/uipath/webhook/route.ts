import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/uipath/webhook
 * Inbound callback from UiPath (or any RPA tool) to update job status.
 * Payload: { jobId: string, status: "Running"|"Dispatched"|"Delivered"|"Failed", message?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, status, message } = body;

    if (!jobId || !status) {
      return NextResponse.json({ error: "jobId and status are required" }, { status: 400 });
    }

    const validStatuses = ["Running", "Dispatched", "Delivered", "Failed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.mockUiPathJob.findFirst({ where: { jobId } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updated = await prisma.mockUiPathJob.updateMany({
      where: { jobId },
      data: { status },
    });

    console.log(
      `[UiPath Callback] Job ${jobId} → ${status}${message ? ` (${message})` : ""}`
    );

    return NextResponse.json({
      received: true,
      jobId,
      status,
      updatedCount: updated.count,
    });
  } catch (error: any) {
    console.error("[UiPath Webhook] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
