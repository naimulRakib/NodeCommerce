import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId");
  
  const tasks = await prisma.mockActionCenterTask.findMany({
    where: shipmentId ? { shipmentId } : undefined,
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json(tasks);
}
