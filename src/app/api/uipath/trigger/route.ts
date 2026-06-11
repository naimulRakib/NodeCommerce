import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Build the rich outbound payload that UiPath will receive */
async function buildWebhookPayload(jobId: string, shipmentId: string) {
  // Fetch shipment items for product details
  const items = await prisma.aCOShipmentItem.findMany({
    where: { shipmentId },
  });

  const itemPayloads = items.map((i: any) => ({
    productName: i.productName ?? "Unknown Product",
    quantity: i.quantity ?? 0,
    unitPrice: i.unitPrice ?? 0,
  }));

  const totalValue = itemPayloads.reduce(
    (sum: number, i: any) => sum + i.quantity * i.unitPrice,
    0
  );

  return {
    event: "district_transfer_approved",
    jobId,
    timestamp: new Date().toISOString(),
    callbackUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXTAUTH_URL ?? "http://localhost:3000" : "http://localhost:3000"}/api/uipath/webhook`,
    shipment: {
      id: shipmentId,
      from: { type: "district", name: "Dhaka District Hub", district: "Dhaka" },
      to:   { type: "upazilla", name: "Dhanmondi Upazilla Hub", upazilla: "Dhanmondi" },
      items: itemPayloads,
      totalValue,
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId } = body;

    const shipment = await prisma.aCOShipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    if (shipment.uipathJobId) {
      console.log(`[UiPath] Duplicate trigger for ${shipmentId} — skipped`);
      return NextResponse.json({ success: true, message: "Duplicate ignored", jobId: shipment.uipathJobId });
    }

    const newJobId = `job-${Date.now()}`;

    // 1. Mark shipment with job id
    await prisma.aCOShipment.update({ where: { id: shipmentId }, data: { uipathJobId: newJobId } });

    // 2. Persist the mock job record
    const payload = await buildWebhookPayload(newJobId, shipmentId);
    await prisma.mockUiPathJob.create({
      data: { jobId: newJobId, shipmentId, status: "Running" },
    });

    // 3. Fire outbound webhook to real UiPath (if configured)
    const webhookUrl = process.env.UIPATH_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const r = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
        console.log(`[UiPath] Outbound webhook fired → ${webhookUrl} (${r.status})`);
      } catch (e: any) {
        // Non-fatal — demo still works without UiPath connectivity
        console.warn(`[UiPath] Outbound webhook failed (non-fatal): ${e.message}`);
      }
    } else {
      console.log("[UiPath] UIPATH_WEBHOOK_URL not set — simulated dispatch only");
    }

    return NextResponse.json({ success: true, jobId: newJobId, payload });

  } catch (error: any) {
    console.error("[UiPath Trigger] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
