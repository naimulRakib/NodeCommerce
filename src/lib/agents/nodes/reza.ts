import { DemandForecast, CriticalAlert, RestockRecommendation } from "../state"
import { sharedTools } from "../tools"

const REZA_SYSTEM_PROMPT_TEMPLATE = (districtContext: string) => `
তুমি REZA — NodeCommerce Bangladesh এর intelligent logistics
এবং demand forecasting সহকারী।

তোমার district context:
${districtContext}

তুমি দুটো কাজ করো:

কাজ ১ — প্রশ্নের উত্তর দাও।
Reseller যা জিজ্ঞেস করে তার সরাসরি উত্তর দাও।
সহজ বাংলায়, সংখ্যা দিয়ে প্রমাণ করে।

কাজ ২ — Proactive forecast insight দাও।
প্রতিটা উত্তরের শেষে একটা relevant forecast insight যোগ করো।
Format:
"💡 AI Forecast: [product] এর চাহিদা আগামী [N] দিনে [X]%
[বাড়বে/কমবে]। [কারণ]। আপনার [recommended action]।"

তুমি যে forecasts জানো:
{forecasts_context}

তুমি যে critical alerts জানো:
{alerts_context}

তুমি যে restock recommendations জানো:
{restock_context}

RULES:
1. কখনো ভুল তথ্য দেবে না।
2. Forecast confidence LOW হলে বলবে এটা নিশ্চিত নয়।
3. অন্য district এর confidential data দেখাবে জাগা না।
4. ROI figures সবসময় BDT তে বলবে।
5. সহজ ভাষায় বলো। Technical jargon avoid করো।
`

async function fetchDistrictContext(districtId: string) {
  // Try fetching district data or fallback
  try {
    const res = await fetch(`${process.env.NODECOMMERCE_BASE_URL}/api/districts/${districtId}`, {
      headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      return JSON.stringify(data);
    }
  } catch(e) {}
  return `District ID: ${districtId}`;
}

export async function createRezaAgent(
  districtId: string,
  sessionId: string,
  forecasts: DemandForecast[],
  alerts: CriticalAlert[],
  recommendations: RestockRecommendation[]
) {
  const { ChatGroq } = await import("@langchain/groq")
  const { createReactAgent } = await import("@langchain/langgraph/prebuilt")

  const districtContext = await fetchDistrictContext(districtId)

  const forecastsContext = forecasts
    .map(f => `${f.productName}: ${f.predictedDemand} units predicted, ` +
              `confidence ${f.confidenceLevel}, ROI if stocked ${f.roiIfStocked} BDT`)
    .join("\n")

  const alertsContext = alerts
    .map(a => `${a.messageBangla} (${a.severity})`)
    .join("\n")

  const restockContext = recommendations
    .map(r => r.reasonBangla)
    .join("\n")

  const systemPrompt = REZA_SYSTEM_PROMPT_TEMPLATE(districtContext)
    .replace("{forecasts_context}", forecastsContext || "No forecasts available")
    .replace("{alerts_context}", alertsContext || "No critical alerts")
    .replace("{restock_context}", restockContext || "No recommendations")

  const llm = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    maxTokens: 1024,
    streaming: true
  })

  return createReactAgent({
    llm,
    tools: sharedTools,
    stateModifier: systemPrompt
  })
}
