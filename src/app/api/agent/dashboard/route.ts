import { NextRequest, NextResponse } from "next/server"

async function fetchLatestForecasts(districtId: string | null) {
  return []; // Mocked for now
}

async function fetchLatestAlerts(districtId: string | null) {
  return []; // Mocked for now
}

async function fetchLatestRecommendations(districtId: string | null) {
  return []; // Mocked for now
}

async function fetchAgentRunHistory() {
  return []; // Mocked for now
}

async function calculateForecastAccuracy(districtId: string | null) {
  return 0.85; // Mocked for now
}

export async function GET(req: NextRequest) {

  const districtId = req.nextUrl.searchParams.get("districtId")

  const [forecasts, alerts, recommendations, agentStatus] =
    await Promise.all([
      fetchLatestForecasts(districtId),
      fetchLatestAlerts(districtId),
      fetchLatestRecommendations(districtId),
      fetchAgentRunHistory()
    ])

  const totalROIIfOptimal = forecasts
    .reduce((sum: number, f: any) => sum + (f.roiIfStocked || 0), 0)

  const totalROIAtRisk = alerts
    .filter((a: any) => a.severity === "CRITICAL")
    .reduce((sum: number, a: any) => sum + (a.estimatedRevenueLoss || 0), 0)

  return NextResponse.json({
    forecasts,
    alerts,
    recommendations,
    agentStatus,
    summary: {
      totalProductsForecasted: forecasts.length,
      criticalAlerts: alerts.filter((a: any) => a.severity === "CRITICAL").length,
      warningAlerts: alerts.filter((a: any) => a.severity === "WARNING").length,
      pendingRecommendations: recommendations.length,
      totalROIIfOptimal,
      totalROIAtRisk,
      forecastAccuracy: await calculateForecastAccuracy(districtId)
    }
  })
}
