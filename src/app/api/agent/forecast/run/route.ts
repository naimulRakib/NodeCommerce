import { NextRequest, NextResponse } from "next/server"
import { buildForecastingGraph } from "@/lib/agents/graph"

export async function POST(req: NextRequest) {

  const cronSecret = req.headers.get("CRON-SECRET")
  const internalKey = req.headers.get("Authorization")

  const isValidCron = cronSecret === process.env.CRON_SECRET
  const isValidInternal = internalKey ===
    `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}`

  if (!isValidCron && !isValidInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { districtId, triggerReason = "scheduled" } = body

  if (!districtId) {
    return NextResponse.json(
      { error: "districtId is required" },
      { status: 400 }
    )
  }

  const graph = buildForecastingGraph()

  const initialState = {
    districtId,
    triggerReason,
    stockSnapshot: {},
    consumptionRates: {},
    salesHistory: [],
    demandForecasts: [],
    criticalAlerts: [],
    restockRecommendations: [],
    roiProjections: [],
    messages: [],
    errors: [],
    runMetadata: {
      startTime: new Date().toISOString(),
      agentsRun: [],
      totalTokensUsed: 0
    }
  }

  const finalState = await graph.invoke(initialState)

  return NextResponse.json({
    success: true,
    districtId,
    agentsRun: finalState.runMetadata.agentsRun,
    forecastCount: finalState.demandForecasts.length,
    criticalAlerts: finalState.criticalAlerts.length,
    recommendations: finalState.restockRecommendations.length,
    errors: finalState.errors
  })
}
