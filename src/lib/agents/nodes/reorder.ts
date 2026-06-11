import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { NodeCommerceStateType, RestockRecommendation } from "../state"
import { sharedTools } from "../tools"
import { forecastingLLM } from "../llm"

const REORDER_SYSTEM_PROMPT = `
You are REORDER, an autonomous supply planning agent for
NodeCommerce Bangladesh. You receive demand forecasts from
FORESIGHT and turn them into actionable restock recommendations.

Your job is to prevent stockouts before they happen and
maximize ROI for every district in the network.

DECISION RULES:

For each product with a demand forecast:

Rule 1 — Only recommend if stockout risk exists.
  If daysStockRemaining > 10: skip this product.
  If daysStockRemaining <= 10: continue to Rule 2.

Rule 2 — Adjust quantity by confidence.
  If confidenceLevel is HIGH:
    recommended_qty = recommendedStockLevel - currentStock
  If confidenceLevel is MEDIUM:
    recommended_qty = (recommendedStockLevel - currentStock) * 0.7
  If confidenceLevel is LOW:
    recommended_qty = (recommendedStockLevel - currentStock) * 0.4
    Flag for human review.

Rule 3 — Find best source district.
  Call get_historical_shipments for each candidate source.
  Score each source:
    reliability_score from past delivery data
    distance_score = 1 / (distanceKm / 100)
    surplus_score = source_stock / recommended_qty
  Best source = highest total score.

Rule 4 — Calculate expected ROI.
  expected_roi = forecast.roiIfStocked - current_investment_cost
  Include in recommendation so ACO can prioritize.

Rule 5 — Set dispatch deadline.
  dispatch_by = stockout_date - transit_time - 1 day buffer
  transit_time from historical shipments average.

Output a JSON array of RestockRecommendation objects.
Post each recommendation using post_forecast_result.

For each recommendation also generate a Bangla reason string
that explains to the reseller in plain language why this
restock is being recommended. Example:
"আপনার চাল মাত্র ৩ দিনের মধ্যে শেষ হবে। Eid এর কারণে
চাহিদা ৮০% বেশি থাকবে। Dhaka থেকে ১৫০০ কেজি পাঠানো
উচিত। এই বিনিয়োগে ২৩% ROI আশা করা যাচ্ছে।"
`

export async function reorderNode(
  state: NodeCommerceStateType
): Promise<Partial<NodeCommerceStateType>> {

  if (state.demandForecasts.length === 0) {
    return {
      errors: ["REORDER skipped: no demand forecasts available"],
      messages: ["REORDER skipped: FORESIGHT produced no forecasts"]
    }
  }

  const agent = createReactAgent({
    llm: forecastingLLM,
    tools: sharedTools,
    stateModifier: REORDER_SYSTEM_PROMPT
  })

  const criticalForecasts = state.demandForecasts.filter(
    f => f.stockoutRiskDate !== null
  )

  const result = await agent.invoke({
    messages: [{
      role: "user",
      content: `Generate restock recommendations for district ${state.districtId}.
                
                Demand forecasts requiring action:
                ${JSON.stringify(criticalForecasts, null, 2)}
                
                For each product find the best source district and
                calculate the optimal restock quantity adjusted for
                forecast confidence. Include expected ROI for each
                recommendation. Generate Bangla explanation strings.`
    }]
  })

  const lastMessage = result.messages[result.messages.length - 1]
  let recommendations: RestockRecommendation[] = []

  try {
    const jsonMatch = lastMessage.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      recommendations = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    return {
      errors: [`REORDER failed to parse output: ${e}`]
    }
  }

  return {
    restockRecommendations: recommendations,
    messages: [
      `REORDER generated ${recommendations.length} recommendations`
    ],
    runMetadata: {
      ...state.runMetadata,
      agentsRun: [...state.runMetadata.agentsRun, "REORDER"]
    }
  }
}
