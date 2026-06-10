import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId } = body;

    const shipment = await prisma.aCOShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    if (shipment.uipathJobId) {
      // Duplicate trigger detected!
      console.log(`[UiPath Trigger] Duplicate trigger detected for ${shipmentId}`);
      // Simulate idempotency by returning success without doing anything
      return NextResponse.json({ success: true, message: "Duplicate ignored", jobId: shipment.uipathJobId });
    }

    // Otherwise, simulate triggering a new job
    const newJobId = `job-${Date.now()}`;
    await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: { uipathJobId: newJobId }
    });

    await prisma.mockUiPathJob.create({
      data: {
        jobId: newJobId,
        shipmentId,
        status: "Running"
      }
    });

    return NextResponse.json({ success: true, jobId: newJobId });

  } catch (error: any) {
    console.error("[UiPath Trigger] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
