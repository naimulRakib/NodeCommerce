import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: truckId } = await params;

    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
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

    return NextResponse.json({
      currentStopIndex: truck.currentStopIndex,
      stops: truck.stops,
    });
  } catch (error: any) {
    console.error("GET stops error:", error);
    return NextResponse.json({ error: "Failed to fetch stops" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: truckId } = await params;
    const body = await request.json();
    const { stopIndex } = body;

    if (typeof stopIndex !== "number") {
      return NextResponse.json({ error: "stopIndex is required" }, { status: 400 });
    }

    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    if (truck.currentStopIndex !== stopIndex) {
      return NextResponse.json(
        { error: `Previous stop not yet completed. Stop ${truck.currentStopIndex} must be completed before stop ${stopIndex}.` },
        { status: 400 }
      );
    }

    const stop = await prisma.truckStop.findFirst({
      where: { truckId, stopIndex },
    });

    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }

    const updatedStop = await prisma.truckStop.update({
      where: { id: stop.id },
      data: {
        status: "truck_arrived",
        actualArrival: new Date(),
      },
      include: { items: true },
    });

    // The user requested to omit the separate 'Truck is HERE now!' notification
    // to avoid system overheat/spam, so we skip createRealtimeAction here 
    // and just return the updated stop.

    return NextResponse.json({ stop: updatedStop });
  } catch (error: any) {
    console.error("PATCH stop arrived error:", error);
    return NextResponse.json({ error: "Failed to update stop status" }, { status: 500 });
  }
}
