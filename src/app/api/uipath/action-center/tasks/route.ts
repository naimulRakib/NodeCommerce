import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "source"; // "source" or "target"
    const shipmentId = searchParams.get("shipmentId");

    let shipments = [];

    if (shipmentId) {
      // Edge Case 2 & 3: Fetch specific shipment regardless of status
      const singleShipment = await prisma.aCOShipment.findUnique({
        where: { id: shipmentId }
      });
      if (singleShipment) shipments = [singleShipment];
    } else {
      let whereClause: any = { phase: 3, status: "pending_approval" };
      if (role === "source") {
        whereClause.sourceApproved = false;
      } else {
        whereClause.targetApproved = false;
      }

      shipments = await prisma.aCOShipment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" }
      });
    }

    // Map to task objects as specified
    const tasks = shipments.map(s => ({
      id: s.id, // Using id as shipmentId
      shipmentId: s.id,
      taskTitle: role === "source" 
        ? `Approve Outbound Transfer from ${s.fromName}` 
        : `Approve Inbound Transfer to ${s.toName}`,
      assignedRole: role,
      fromDistrict: s.fromName,
      toDistrict: s.toName,
      fromId: s.fromId,
      toId: s.toId,
      totalWeightKg: s.totalWeightKg || s.totalQuantity,
      totalQuantity: s.totalQuantity,
      overallRisk: s.overallRisk || "NORMAL",
      riskScore: s.riskScore || 0,
      expiresAt: s.expiresAt,
      overallAcoScore: s.overallAcoScore,
      distanceKm: s.distanceKm,
      historicalDelayRate: s.historicalDelayRate,
      seasonalRiskFlag: s.seasonalRiskFlag,
      currentWeather: s.currentWeather,
      overBudgetFlag: s.overBudgetFlag,
      confirmedFreight: s.confirmedFreight,
      negotiatedMaxPrice: s.negotiatedMaxPrice,
      driverName: s.driverName,
      driverPhone: s.driverPhone,
      licensePlate: s.licensePlate,
      transportAgency: s.transportAgency,
      uipathJobId: s.uipathJobId,
      sourceApproved: s.sourceApproved,
      targetApproved: s.targetApproved
    }));

    return NextResponse.json({ tasks });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
