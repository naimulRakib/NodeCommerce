import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Get district stock
    const stocks = await prisma.districtStockItem.findMany({
      where: { districtResellerId: user.id }
    });

    if (!stocks.length) {
      return NextResponse.json({
        analysis: "আপনার ডিস্ট্রিক্ট হাবে বর্তমানে কোনো স্টক নেই। উপজেলা হাব থেকে উদ্বৃত্ত স্টক আসার জন্য অপেক্ষা করুন অথবা অন্যান্য ডিস্ট্রিক্টের চাহিদা পর্যবেক্ষণ করুন।",
        metrics: [],
      });
    }

    const stockData = stocks.map(s => ({
      name: s.productName,
      stock: s.quantity,
    }));

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROK_API_KEY is not configured on the server." }, { status: 500 });
    }

    const prompt = `
You are an expert AI hub manager for a District Reseller in Bangladesh.
Analyze these current District Hub stocks and provide a short, professional stock management suggestion in Bengali.
Tell them which products are ready for National dispatch and the overall demand trend. Keep the analysis under 150 words.

You MUST respond ONLY with a valid JSON object in the following format:
{
  "analysis": "Your detailed market analysis in Bengali here...",
  "metrics": [
    { "label": "Metric Name (e.g., National Demand Growth)", "value": "+40%", "trend": "up" },
    { "label": "Another Metric", "value": "Fast", "trend": "up" }
  ]
}

Ensure "trend" is either "up" or "down".

District Hub Stocks:
${JSON.stringify(stockData, null, 2)}
`;

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!res.ok) {
      throw new Error(`Grok API error: ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse Grok JSON:", content);
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
    }

    return NextResponse.json({ 
      analysis: parsed.analysis || "বিশ্লেষণ তৈরি করা সম্ভব হয়নি।", 
      metrics: parsed.metrics || [] 
    });

  } catch (error: any) {
    console.error("District AI Predict Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
