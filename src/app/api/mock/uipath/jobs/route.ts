import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { ShipmentId, SourceEmail, TargetEmail, SourcePhone, TargetPhone } = payload;

    // 1. Create the Mock UiPath Job
    const job = await prisma.mockUiPathJob.create({
      data: {
        shipmentId: ShipmentId || "UNKNOWN",
        inputArguments: payload,
        status: "Running",
      },
    });

    // 2. Simulate UiPath creating Action Center Tasks
    if (SourceEmail) {
      await prisma.mockActionCenterTask.create({
        data: {
          assignedTo: SourceEmail,
          title: `Action Required: Approve Shipment ${ShipmentId}`,
          priority: "High",
          shipmentId: ShipmentId,
          deadline: payload.ExpiresAt ? new Date(payload.ExpiresAt) : null,
        },
      });
    }

    if (TargetEmail) {
      await prisma.mockActionCenterTask.create({
        data: {
          assignedTo: TargetEmail,
          title: `Action Required: Approve Receipt ${ShipmentId}`,
          priority: "High",
          shipmentId: ShipmentId,
          deadline: payload.ExpiresAt ? new Date(payload.ExpiresAt) : null,
        },
      });
    }

    // 3. Simulate UiPath sending WhatsApp notifications
    if (SourcePhone) {
      await prisma.mockNotificationLog.create({
        data: {
          type: "whatsapp",
          recipient: SourcePhone,
          body: `Action required for shipment ${ShipmentId}. Please approve via Action Center. Route: ${payload.FromDistrict} to ${payload.ToDistrict}.`,
          shipmentId: ShipmentId,
        },
      });
    }

    if (TargetPhone) {
      await prisma.mockNotificationLog.create({
        data: {
          type: "whatsapp",
          recipient: TargetPhone,
          body: `Action required for shipment ${ShipmentId}. Please approve via Action Center. Route: ${payload.FromDistrict} to ${payload.ToDistrict}.`,
          shipmentId: ShipmentId,
        },
      });
    }

    // Return the fake job ID
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "Mock UiPath Job Started",
    });
  } catch (error) {
    console.error("[Mock UiPath] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId");
  
  const jobs = await prisma.mockUiPathJob.findMany({
    where: shipmentId ? { shipmentId } : undefined,
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json(jobs);
}
