import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        stops: {
          include: { items: true },
          orderBy: { stopIndex: "asc" },
        },
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    return NextResponse.json({ truck });
  } catch (error: any) {
    console.error("GET truck error:", error);
    return NextResponse.json({ error: "Failed to fetch truck" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, currentStopIndex } = body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === "in_transit") {
        data.departedAt = new Date();
      } else if (status === "completed") {
        data.completedAt = new Date();
      }
    }
    
    if (typeof currentStopIndex === "number") {
      data.currentStopIndex = currentStopIndex;
    }

    const truck = await prisma.truck.update({
      where: { id },
      data,
    });

    return NextResponse.json({ truck });
  } catch (error: any) {
    console.error("PATCH truck error:", error);
    return NextResponse.json({ error: "Failed to update truck" }, { status: 500 });
  }
}
