import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Get seller's products
    const products = await prisma.sellerProduct.findMany({
      where: { sellerId: user.id },
      include: { globalProduct: true },
    });

    if (!products.length) {
      return NextResponse.json({
        analysis: "আপনার ইনভেন্টরিতে কোনো পণ্য নেই। প্রথমে কিছু পণ্য যুক্ত করুন যাতে আমি বিশ্লেষণ করতে পারি।",
        metrics: [],
      });
    }

    // Format products for Grok prompt
    const productData = products.map(p => ({
      name: p.globalProduct?.name || p.customName,
      stock: p.stock,
      price: p.price,
    }));

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROK_API_KEY is not configured on the server." }, { status: 500 });
    }

    const prompt = `
You are an expert AI market analyst for a seller in Bangladesh.
Analyze these products and provide a short, professional market prediction in Bengali.
Tell them if demand will increase/decrease and if they should adjust prices. Keep the analysis under 150 words.

You MUST respond ONLY with a valid JSON object in the following format:
{
  "analysis": "Your detailed market analysis in Bengali here...",
  "metrics": [
    { "label": "Metric Name (e.g., Demand Forecast)", "value": "+20%", "trend": "up" },
    { "label": "Another Metric", "value": "Low", "trend": "down" }
  ]
}

Ensure "trend" is either "up" or "down".

Seller Products:
${JSON.stringify(productData, null, 2)}
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
    console.error("AI Predict Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
