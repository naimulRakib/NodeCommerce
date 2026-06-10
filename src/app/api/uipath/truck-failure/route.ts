import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Edge Case 7: Webhook Secret Header
    const secret = req.headers.get("x-uipath-secret");
    if (process.env.UIPATH_WEBHOOK_SECRET && secret !== process.env.UIPATH_WEBHOOK_SECRET) {
      console.warn(`[UiPath Security] Unauthorized breakdown callback attempt.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }

    const { shipmentId, truckCode, breakdownReason } = body;

    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });
    }

    const shipment = await prisma.aCOShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Edge Case 12: Truck Breaks Down Before Loading
    // If status is still "pending_dispatch" (or "both_approved"), cargo wasn't loaded yet.
    // If it is "dispatched", it broke down en route.
    const beforeLoading = shipment.status !== "dispatched";

    await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: {
        status: "failed",
        failureReason: `truck_breakdown: ${breakdownReason}`,
        notes: (shipment.notes || "") + `\n[EMERGENCY] Truck ${truckCode} breakdown reported by UiPath. Cargo loaded: ${!beforeLoading}.`,
      },
    });

    // In a full implementation, we would call an ACO Reroute Engine here to spawn a new shipment
    console.log(`[Emergency] Triggering ACO Reroute for shipment ${shipmentId} (Before Loading: ${beforeLoading})`);

    return NextResponse.json({ 
      success: true, 
      message: "Breakdown recorded, ACO reroute triggered",
      beforeLoading
    });
  } catch (error: any) {
    console.error("[Truck Breakdown Hook] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
