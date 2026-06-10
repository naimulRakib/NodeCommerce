import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { agencyName: string } }) {
  try {
    const payload = await req.json();
    
    const log = await prisma.mockThirdPartyAgencyLog.create({
      data: {
        agencyName: params.agencyName,
        shipmentId: payload.shipmentId || "UNKNOWN",
        quoteAmount: payload.quoteAmount || 0,
        status: payload.status || "visited",
      }
    });

    return NextResponse.json({ success: true, logId: log.id, quote: payload.quoteAmount });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { agencyName: string } }) {
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId");
  
  const logs = await prisma.mockThirdPartyAgencyLog.findMany({
    where: {
      agencyName: params.agencyName,
      ...(shipmentId ? { shipmentId } : {}),
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json(logs);
}
