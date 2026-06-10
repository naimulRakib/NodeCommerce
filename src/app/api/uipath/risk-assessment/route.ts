import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-uipath-secret");
    if (process.env.UIPATH_WEBHOOK_SECRET && secret !== process.env.UIPATH_WEBHOOK_SECRET) {
      console.warn(`[UiPath Security] Unauthorized callback attempt. Invalid or missing secret.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }
    const { shipmentId, riskScore, overallRisk } = body;

    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });
    }

    const shipment = await prisma.aCOShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: {
        riskScore,
        overallRisk,
      },
    });

    return NextResponse.json({ success: true, message: "Risk assessment saved" });
  } catch (error: any) {
    console.error("[UiPath Risk Hook] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
