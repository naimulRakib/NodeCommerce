import { buildForecastingGraph } from "./graph"

// Edge Case Mocks
const MOCK_DATA = {
  // EC1: Zero History Paradox
  "dist_zero_history": {
    stock: { "PRD-001": 150 },
    sales: [],
    weather: { rainProbability: 10, floodRisk: false },
    events: []
  },
  // EC2: Tool Failure (simulate by throwing error in mock fetch)
  "dist_tool_fail": {
    stock: { "PRD-002": 50 },
    sales: Array(90).fill({ quantitySold: 10, revenue: 100 }),
    weather: "FAIL", // Force failure
    events: []
  },
  // EC3: Hyper Volatility
  "dist_hyper_volatile": {
    stock: { "PRD-003": 20 },
    sales: Array.from({length: 90}, (_, i) => ({ quantitySold: i % 2 === 0 ? 500 : 0, revenue: 5000 })),
    weather: { rainProbability: 5, floodRisk: false },
    events: []
  },
  // EC4: Conflicting Multipliers (Flood + Harvest)
  "dist_conflict": {
    stock: { "PRD-004": 100 },
    sales: Array(90).fill({ quantitySold: 20, revenue: 200 }),
    weather: { rainProbability: 95, floodRisk: true }, // Flood = 1.4x
    events: [{ name: "Harvest Season", daysUntil: 2 }] // Harvest = 0.7x
  },
  // EC5: National Stockout (No Surplus)
  "dist_stockout": {
    stock: { "PRD-005": 5 }, // Needs restock
    sales: Array(90).fill({ quantitySold: 30, revenue: 300 }),
    weather: { rainProbability: 0, floodRisk: false },
    events: [],
    shipments: [] // No reliable routes/surplus
  },
  // EC7: Fast Path Short Circuit
  "dist_empty": {
    stock: {},
    sales: [],
    weather: { rainProbability: 0, floodRisk: false },
    events: []
  },
  // EC8: Healthy District Bypass
  "dist_healthy": {
    stock: { "PRD-006": 10000 }, // Huge stock
    sales: Array(90).fill({ quantitySold: 5, revenue: 50 }), // Low sales
    weather: { rainProbability: 0, floodRisk: false },
    events: []
  }
}

// Intercept Global Fetch
const originalFetch = global.fetch;
global.fetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = url.toString()
  const matchDist = urlStr.match(/districtId=([^&]+)/) || urlStr.match(/districts\/([^\/]+)/)
  const distId = matchDist ? matchDist[1] : "dist_healthy"
  const mockData = (MOCK_DATA as any)[distId] || MOCK_DATA["dist_healthy"]

  if (urlStr.includes('/api/districts/')) {
    return new Response(JSON.stringify(mockData.stock))
  }
  if (urlStr.includes('/api/analytics/sales')) {
    return new Response(JSON.stringify(mockData.sales))
  }
  if (urlStr.includes('/api/weather')) {
    if (mockData.weather === "FAIL") throw new Error("Weather API Timeout")
    return new Response(JSON.stringify(mockData.weather))
  }
  if (urlStr.includes('/api/events/calendar')) {
    return new Response(JSON.stringify(mockData.events))
  }
  if (urlStr.includes('/api/market/prices')) {
    return new Response(JSON.stringify({ price: 100, trend: "STABLE" }))
  }
  if (urlStr.includes('/api/shipments/history')) {
    return new Response(JSON.stringify(mockData.shipments || [{ sourceDistrictId: "dist_dhaka", reliabilityScore: 0.9, surplusStock: 500 }]))
  }
  if (urlStr.includes('/api/agent/forecasts')) {
    return new Response(JSON.stringify({ success: true }))
  }
  
  return originalFetch(url, init)
}

async function runEdgeCaseVerification() {
  if (!process.env.GROQ_API_KEY) {
    console.error("ERROR: GROQ_API_KEY environment variable is required to run live tests.");
    process.exit(1);
  }

  const graph = buildForecastingGraph()
  const tests = Object.keys(MOCK_DATA)

  for (const distId of tests) {
    console.log(`\n=============================================`)
    console.log(`Executing Edge Case Test for: ${distId}`)
    console.log(`=============================================`)
    
    const initialState = {
      districtId: distId,
      triggerReason: "edge_case_verification",
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

    try {
      const result = await graph.invoke(initialState)
      console.log(`[PASS] Agents Run: ${result.runMetadata.agentsRun.join(" -> ")}`)
      
      if (result.errors.length > 0) {
        console.warn(`[WARN] Errors encountered:`, result.errors)
      }
      
      if (result.demandForecasts.length > 0) {
        console.log(`[INFO] Forecast Confidence: ${result.demandForecasts[0].confidenceLevel} (${result.demandForecasts[0].confidenceScore})`)
        if (result.demandForecasts[0].keyDrivers.length > 0) {
           console.log(`[INFO] Key Drivers: ${result.demandForecasts[0].keyDrivers[0]}`)
        }
      }
      
      if (result.restockRecommendations.length > 0) {
        console.log(`[INFO] Recommendation Qty: ${result.restockRecommendations[0].quantityKg}`)
        console.log(`[INFO] Priority: ${result.restockRecommendations[0].priority}`)
      }

    } catch (e) {
      console.error(`[FAIL] Graph crashed on ${distId}:`, e)
    }
  }
}

runEdgeCaseVerification()
