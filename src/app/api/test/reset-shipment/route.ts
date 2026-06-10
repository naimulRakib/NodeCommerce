import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const secret = req.headers.get("TEST_RESET_SECRET");
    const validSecret = process.env.TEST_RESET_SECRET;

    if (!isDev && secret !== validSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shipmentId } = await req.json();

    const shipment = await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: {
        sourceApproved: false,
        targetApproved: false,
        status: "pending_approval"
      }
    });

    return NextResponse.json({ success: true, shipment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
