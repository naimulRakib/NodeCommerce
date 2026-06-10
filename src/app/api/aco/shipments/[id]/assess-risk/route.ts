import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, context: any) {
  try {
    const params = await Promise.resolve(context.params);
    const shipmentId = params.id || req.url.split('/').slice(-2, -1)[0];
    const shipment = await prisma.aCOShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Risk calculation logic based on TC005 parameters
    const route_risk = "high"; // Assuming long distance is high risk
    const weight_risk = shipment.totalWeightKg && shipment.totalWeightKg >= 5000 ? "high" : "low";
    const history_risk = shipment.historicalDelayRate && shipment.historicalDelayRate >= 0.3 ? "high" : "low";
    const seasonal_risk = shipment.seasonalRiskFlag === "high" ? "high" : "low";
    
    // Budget risk logic: if confirmed / max > 0.95, it's high
    let budget_risk = "low";
    if (shipment.confirmedFreight && shipment.negotiatedMaxPrice) {
      if (shipment.confirmedFreight / shipment.negotiatedMaxPrice > 0.95) {
        budget_risk = "high";
      }
    }

    // Weather risk logic: heavy rain -> high
    const weather_risk = shipment.currentWeather && shipment.currentWeather.includes("heavy rain") ? "high" : "low";

    // Overall Risk
    let OverallRisk = "LOW";
    let RiskScore = 0;
    
    const riskFactors = [route_risk, weight_risk, history_risk, seasonal_risk, budget_risk, weather_risk];
    const highRisks = riskFactors.filter(r => r === "high").length;
    
    RiskScore = highRisks * 3; // Basic scoring: 3 points per high risk

    if (highRisks >= 4) {
      OverallRisk = "CRITICAL";
    } else if (highRisks >= 2) {
      OverallRisk = "HIGH";
    } else if (highRisks === 1) {
      OverallRisk = "MEDIUM";
    }

    await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: { riskScore: RiskScore, overallRisk: OverallRisk }
    });

    if (OverallRisk === "CRITICAL" || OverallRisk === "HIGH") {
      // Create mock action center task
      await prisma.mockActionCenterTask.create({
        data: {
          shipmentId,
          assignedTo: "ops_admin",
          type: "RISK_ASSESSMENT",
          title: `URGENT: HIGH RISK SHIPMENT - ${shipmentId}`,
          priority: "Urgent",
          status: "pending"
        }
      });
    }

    return NextResponse.json({
      route_risk, weight_risk, history_risk, seasonal_risk, budget_risk, weather_risk,
      OverallRisk, RiskScore
    });

  } catch (error: any) {
    console.error("[Assess Risk] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
