import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pre-scripted demo thoughts for the "PROVA" Grok AI agent
// Looks identical to real streaming — runs without a GROQ API key
const DEMO_THOUGHTS = [
  { delay: 200,  text: "🔍 Initializing PROVA demand-intelligence agent..." },
  { delay: 600,  text: "📊 Pulling 14 days of buyer behaviour data from Dhanmondi..." },
  { delay: 900,  text: "🧮 Found 847 search events for 'Miniket Rice' in last 6 hours." },
  { delay: 700,  text: "📈 Search volume spike: +1,240% above 7-day baseline." },
  { delay: 800,  text: "🏪 Cross-referencing against seller stock levels..." },
  { delay: 600,  text: "✅ 'Fresh Farm Goods' (Dhanmondi): 1,000 units available." },
  { delay: 700,  text: "📉 Current Upazilla stock: 0 units. Local Reseller: 0 units." },
  { delay: 900,  text: "🧠 Running demand-supply gap forecast model..." },
  { delay: 1000, text: "⚡ ALERT: Critical shortage predicted in Dhanmondi in ~48 hours." },
  { delay: 600,  text: "📦 Recommended action: source 500 units immediately." },
  { delay: 500,  text: "🐜 Dispatching ACO Routing Algorithm to plan optimal delivery..." },
  { delay: 800,  text: "🗺️  ACO found best route: Seller → Upazilla Hub → Local Hub → Buyer." },
  { delay: 600,  text: "🤖 Notifying UiPath agent to book logistics and dispatch truck..." },
  { delay: 700,  text: "✅ UiPath job dispatched. Truck booked. ETA: 4 hours." },
  { delay: 400,  text: "🎯 PROVA analysis complete. Supply chain intervention initiated." },
];

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));
      };

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // If GROQ key present, call real API (future-proof)
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        // Delegate to real Groq API via langchain — left as future enhancement
        // For now fall through to demo mode even if key exists
      }

      // Demo mode: stream pre-scripted thoughts
      for (const thought of DEMO_THOUGHTS) {
        await sleep(thought.delay);
        send(thought.text);
      }

      // Signal completion
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
