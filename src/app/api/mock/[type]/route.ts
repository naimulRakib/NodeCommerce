import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Handles POST to /api/mock/whatsapp, sms, email
export async function POST(req: NextRequest) {
  try {
    // Extract the type from the URL path: /api/mock/whatsapp -> whatsapp
    const pathSegments = req.nextUrl.pathname.split('/');
    const type = pathSegments[pathSegments.length - 1]; // "whatsapp", "sms", or "email"
    
    const payload = await req.json();
    
    const log = await prisma.mockNotificationLog.create({
      data: {
        type,
        recipient: payload.recipient || payload.to || "unknown",
        subject: payload.subject || null,
        body: payload.body || payload.message || JSON.stringify(payload),
        shipmentId: payload.shipmentId || null,
      }
    });

    return NextResponse.json({ success: true, logId: log.id });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // optional filter
  const shipmentId = url.searchParams.get("shipmentId");
  
  const logs = await prisma.mockNotificationLog.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(shipmentId ? { shipmentId } : {}),
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json(logs);
}
