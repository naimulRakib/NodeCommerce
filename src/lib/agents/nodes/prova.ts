import { ChatGroq } from "@langchain/groq"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { NodeCommerceStateType } from "../state"
import { sharedTools } from "../tools"
import { forecastingLLM } from "../llm"

const PROVA_SYSTEM_PROMPT = `
You are PROVA, a data collection agent for NodeCommerce Bangladesh.
Your job is to gather comprehensive data for demand forecasting.

For the given district, you must collect ALL of the following:

1. Current stock levels for every product using get_district_stock
2. Sales history for the past 90 days for every product using
   get_sales_history with days=90
3. Weather forecast for the next 14 days using get_weather_forecast
4. Upcoming events and festivals for the next 30 days using
   get_upcoming_events

After collecting all data, calculate these metrics for each product:

- 7 day average daily sales (recent trend)
- 30 day average daily sales (medium trend)  
- 90 day average daily sales (baseline)
- Sales trend direction: compare 7-day average to 90-day average.
  If 7-day is more than 20% higher: INCREASING
  If 7-day is more than 20% lower: DECREASING
  Otherwise: STABLE
- Days of stock remaining at current consumption rate
- Revenue per unit sold (from sales history)

Output a JSON object with this exact structure:
{
  "districtId": "...",
  "collectedAt": "ISO timestamp",
  "products": [
    {
      "productCode": "...",
      "productName": "...",
      "currentStock": ...,
      "avg7DaySales": ...,
      "avg30DaySales": ...,
      "avg90DaySales": ...,
      "trendDirection": "INCREASING|STABLE|DECREASING",
      "daysStockRemaining": ...,
      "revenuePerUnit": ...,
      "weatherImpactExpected": true/false,
      "upcomingEventImpact": "none|low|medium|high",
      "upcomingEventName": "..." or null
    }
  ]
}

Be thorough. Collect data for every product that has any
sales history in the past 90 days. Do not skip products.
`

export async function provaNode(
  state: NodeCommerceStateType
): Promise<Partial<NodeCommerceStateType>> {

  const agent = createReactAgent({
    llm: forecastingLLM,
    tools: sharedTools,
    stateModifier: PROVA_SYSTEM_PROMPT
  })

  const result = await agent.invoke({
    messages: [{
      role: "user",
      content: `Collect all demand data for district ${state.districtId}. 
                Trigger reason: ${state.triggerReason}.
                Be thorough and collect 90 days of sales history.`
    }]
  })

  const lastMessage = result.messages[result.messages.length - 1]
  let provaData

  try {
    const jsonMatch = lastMessage.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      provaData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    return {
      errors: [`PROVA failed to parse output: ${e}`]
    }
  }

  const stockSnapshot: Record<string, number> = {}
  const consumptionRates: Record<string, number> = {}

  for (const product of provaData?.products || []) {
    stockSnapshot[product.productCode] = product.currentStock
    consumptionRates[product.productCode] = product.avg30DaySales
  }

  const postForecastResult = sharedTools.find(t => t.name === "post_forecast_result")
  if (postForecastResult) {
    await postForecastResult.invoke({
      agentName: "PROVA",
      forecastType: "data_collection",
      payload: provaData
    })
  }

  return {
    stockSnapshot,
    consumptionRates,
    messages: [`PROVA completed data collection for ${state.districtId}`],
    runMetadata: {
      ...state.runMetadata,
      agentsRun: [...state.runMetadata.agentsRun, "PROVA"]
    }
  }
}
