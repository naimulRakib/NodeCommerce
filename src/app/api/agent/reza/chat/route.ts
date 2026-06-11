import { NextRequest } from "next/server"
import { createRezaAgent } from "@/lib/agents/nodes/reza"

async function fetchLatestForecasts(districtId: string) {
  try {
    const res = await fetch(`${process.env.NODECOMMERCE_BASE_URL}/api/agent/forecasts?districtId=${districtId}&type=foresight`, {
      headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.payload || [];
    }
  } catch(e) {}
  return [];
}

async function fetchLatestAlerts(districtId: string) {
  return []; // Mocked for now, normally would query db for alerts
}

async function fetchLatestRecommendations(districtId: string) {
  try {
    const res = await fetch(`${process.env.NODECOMMERCE_BASE_URL}/api/agent/forecasts?districtId=${districtId}&type=reorder`, {
      headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.payload || [];
    }
  } catch(e) {}
  return [];
}

export async function POST(req: NextRequest) {

  const { districtId, message, sessionId, resellerId } = await req.json()

  const latestForecasts = await fetchLatestForecasts(districtId)
  const latestAlerts = await fetchLatestAlerts(districtId)
  const latestRecommendations = await fetchLatestRecommendations(districtId)

  const agent = await createRezaAgent(
    districtId,
    sessionId,
    latestForecasts,
    latestAlerts,
    latestRecommendations
  )

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const streamResult = await agent.stream({
        messages: [{ role: "user", content: message }]
      })

      for await (const chunk of streamResult as any) {
        if (chunk.agent?.messages?.[0]?.content) {
          const token = chunk.agent.messages[0].content
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
