import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { shipmentId, filedBy, disputeType, claimDescription } = await req.json();

    // Mock JUDGE logic
    const verdict = "PARTIALLY_UPHELD";
    const finding = "The transport agency is responsible for the discrepancy based on the trip sheet and delivery confirmation.";
    const compensation = 200 * 50; // 200 * rice market rate (assume 50 BDT) = 10000
    const banglaVerdict = "এই রায়ের (verdict) মাধ্যমে পরিবহন সংস্থাকে দায়ী করা হয়েছে। প্রমাণস্বরূপ ট্রিপ শিট এবং ডেলিভারি কনফার্মেশন যাচাই করা হয়েছে। ট্রান্সপোর্ট এজেন্সির অবহেলার কারণে এই ক্ষতি হয়েছে।";

    // Send notifications
    const shipment = await prisma.aCOShipment.findUnique({ where: { id: shipmentId } });
    if (shipment) {
      await prisma.mockNotificationLog.create({
        data: { type: "whatsapp", recipient: shipment.fromId || "source", subject: "Verdict", body: verdict }
      });
      await prisma.mockNotificationLog.create({
        data: { type: "whatsapp", recipient: shipment.toId || "target", subject: "Verdict", body: verdict }
      });
    }

    return NextResponse.json({
      verdict: {
        evidenceReviewed: ["Transfer Certificate", "Delivery Confirmation", "Driver Trip Sheet", "Weather Report"],
        verdict,
        finding,
        compensation,
        banglaVerdict
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
