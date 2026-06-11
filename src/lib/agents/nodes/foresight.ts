import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { NodeCommerceStateType, DemandForecast, CriticalAlert } from "../state"
import { sharedTools } from "../tools"
import { forecastingLLM } from "../llm"

const FORESIGHT_SYSTEM_PROMPT = `
You are FORESIGHT, the demand forecasting intelligence engine
for NodeCommerce Bangladesh.

Your job is to analyze sales patterns and predict future demand
for each product in a district. You must produce forecasts that
help small and medium businesses plan their inventory.

You have access to:
- get_sales_history: Get detailed daily sales data
- get_market_prices: Get current and trend prices
- get_weather_forecast: Get weather that affects buying
- get_upcoming_events: Get festivals and events that spike demand
- get_historical_shipments: Get route reliability for ROI calc

FORECASTING METHODOLOGY:

For each product, apply these steps in order.

Step 1 — Baseline Demand.
  Get 90 days of sales history.
  Calculate 3 averages:
    short_avg = average of last 7 days
    medium_avg = average of last 30 days  
    long_avg = average of last 90 days
  Base forecast = weighted average:
    forecast = (short_avg * 0.5) + (medium_avg * 0.3) + (long_avg * 0.2)

Step 2 — Seasonal Adjustment.
  Check upcoming events for the next 14 days.
  Apply these multipliers to the forecast:
    Eid week within 7 days: multiply by 2.5
    Eid week within 14 days: multiply by 1.8
    Ramadan active: multiply by 1.6 for food items
    Harvest season (October-December): multiply by 0.7
      because buyers have more cash and buy more at once
      reducing daily visit frequency
    Flood or heavy rain forecast: multiply by 1.4
      because people stock up before floods
    Normal: multiply by 1.0

Step 3 — Trend Adjustment.
  If trendDirection is INCREASING:
    Apply additional 1.1 multiplier per week of forecast
  If trendDirection is DECREASING:
    Apply 0.95 multiplier per week
  If STABLE: no adjustment

Step 4 — Confidence Score.
  Start with base confidence of 0.85.
  If sales history is less than 30 days: subtract 0.20
  If coefficient of variation of daily sales exceeds 0.5: subtract 0.15
  If upcoming event impact is high: subtract 0.10
    because events make demand unpredictable
  If weather forecast is clear: add 0.05
  Round confidence to 2 decimal places.
  
  Classify:
    If confidence >= 0.75: HIGH
    If confidence >= 0.55: MEDIUM
    Otherwise: LOW

Step 5 — ROI Projection.
  For each product calculate two scenarios:
  
  Scenario A — Optimal Stock (stock to forecasted demand level):
    revenue = predicted_demand * revenue_per_unit
    investment = recommended_stock_level * cost_per_unit
    profit = revenue - investment
    roi_percent = (profit / investment) * 100

  Scenario B — Stockout Risk (current stock runs out mid-period):
    days_until_stockout = current_stock / avg_daily_sales
    lost_revenue = (forecast_period - days_until_stockout) 
                   * avg_daily_sales * revenue_per_unit
    roi_penalty = lost_revenue as negative ROI impact

Step 6 — Final Output.
  For each product produce a DemandForecast object with all
  calculated values. Classify stockout risk:
    If days_stock_remaining < 2: stockoutRisk = CRITICAL
    If days_stock_remaining < 5: stockoutRisk = WARNING
    Otherwise: stockoutRisk = NORMAL

Output a JSON array of DemandForecast objects.
Each object must have these fields:
  productCode, productName, districtId,
  forecastPeriodDays (always 14),
  predictedDemand, confidenceScore, confidenceLevel,
  upperBound (forecast * 1.3),
  lowerBound (forecast * 0.7),
  forecastMethod ("weighted_moving_average_with_seasonal"),
  keyDrivers (array of strings explaining what drove the forecast),
  seasonalFactor, trendDirection, stockoutRiskDate,
  recommendedStockLevel, roiIfStocked, roiIfStockout

After generating forecasts, post them using post_forecast_result.

IMPORTANT RULES:
1. Never make up data. Only use data returned by tools.
2. If a tool call fails, mark that product forecast as
   LOW confidence and note the missing data.
3. Always include keyDrivers. A forecast with no explanation
   has zero business value.
4. ROI numbers must be in BDT.
5. All forecasts are for 14 days ahead.
`

export async function foresightNode(
  state: NodeCommerceStateType
): Promise<Partial<NodeCommerceStateType>> {

  const agent = createReactAgent({
    llm: forecastingLLM,
    tools: sharedTools,
    stateModifier: FORESIGHT_SYSTEM_PROMPT
  })

  const productsToForecast = Object.keys(state.stockSnapshot)

  const result = await agent.invoke({
    messages: [{
      role: "user",
      content: `Generate 14-day demand forecasts for district ${state.districtId}.
                
                Products to forecast: ${productsToForecast.join(", ")}
                
                Current stock snapshot: ${JSON.stringify(state.stockSnapshot)}
                
                Current consumption rates: ${JSON.stringify(state.consumptionRates)}
                
                Apply seasonal adjustments, trend analysis, and ROI projections
                for each product. Use all available tools to gather additional
                data needed for accuracy.`
    }]
  })

  const lastMessage = result.messages[result.messages.length - 1]
  let forecasts: DemandForecast[] = []

  try {
    const jsonMatch = lastMessage.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      forecasts = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    return {
      errors: [`FORESIGHT failed to parse output: ${e}`]
    }
  }

  const criticalAlerts: CriticalAlert[] = forecasts
    .filter(f => f.stockoutRiskDate !== null)
    .map(f => {
      const daysRemaining = Math.floor(
        (new Date(f.stockoutRiskDate!).getTime() - Date.now()) / 86400000
      )
      return {
        productCode: f.productCode,
        districtId: state.districtId,
        severity: daysRemaining < 2 ? "CRITICAL" : daysRemaining < 5 ? "WARNING" : "WATCH",
        message: `${f.productName} predicted to stock out in ${daysRemaining} days`,
        messageBangla: `${f.productName} আর মাত্র ${daysRemaining} দিনের মধ্যে শেষ হবে`,
        predictedStockoutDate: f.stockoutRiskDate!,
        daysRemaining,
        estimatedRevenueLoss: Math.abs(f.roiIfStockout)
      }
    })

  return {
    demandForecasts: forecasts,
    criticalAlerts,
    messages: [`FORESIGHT generated ${forecasts.length} forecasts for ${state.districtId}`],
    runMetadata: {
      ...state.runMetadata,
      agentsRun: [...state.runMetadata.agentsRun, "FORESIGHT"]
    }
  }
}
