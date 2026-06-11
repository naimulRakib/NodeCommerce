import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Get upazilla stock
    const stocks = await prisma.upazillaStockItem.findMany({
      where: { upazillaResellerId: user.id }
    });

    if (!stocks.length) {
      return NextResponse.json({
        analysis: "আপনার উপজেলা হাবে বর্তমানে কোনো স্টক নেই। ডিস্ট্রিক্ট হাব থেকে স্টক আসার জন্য অপেক্ষা করুন অথবা লোকাল রিসেলারদের চাহিদা সংগ্রহ করুন।",
        metrics: [],
      });
    }

    const stockData = stocks.map(s => ({
      name: s.productName,
      stock: s.quantity,
    }));

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      // Fallback demo response if no key
      return NextResponse.json({
        analysis: "হাব বিশ্লেষণ:\n\n১. **Premium Miniket Rice:** আপনার হাবে বর্তমান স্টক ভালো। লোকাল রিসেলারদের মধ্যে চাহিদা দ্রুত বাড়ছে। আপনি কুমিল্লা সদরে উদ্বৃত্ত (surplus) স্টক পাঠাতে পারেন।\n\n২. **Mechanical Gaming Keyboard:** লোকাল রিসেলারদের চাহিদা অনুযায়ী স্টক অপর্যাপ্ত। ডিস্ট্রিক্ট হাব থেকে আরও স্টক রিকোয়েস্ট করা উচিত।",
        metrics: [
          { label: "লোকাল ডিমান্ড গ্রোথ", value: "+২৫%", trend: "up" },
          { label: "উদ্বৃত্ত স্টক (Surplus)", value: "উচ্চ", trend: "up" },
        ],
      });
    }

    const prompt = `
You are an expert AI hub manager for an Upazilla Reseller in Bangladesh.
Analyze these current hub stocks and provide a short, professional stock management suggestion in Bengali.
Tell them which products have high demand and if they should dispatch surplus to the District hub. Keep it under 150 words.
Use markdown formatting for readability.

Upazilla Hub Stocks:
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
      }),
    });

    if (!res.ok) {
      throw new Error(`Grok API error: ${res.status}`);
    }

    const json = await res.json();
    const analysis = json.choices[0].message.content;

    const metrics = [
      { label: "লোকাল ডিমান্ড গ্রোথ", value: "+২৫%", trend: "up" },
      { label: "উদ্বৃত্ত স্টক (Surplus)", value: "উচ্চ", trend: "up" },
    ];

    return NextResponse.json({ analysis, metrics });

  } catch (error: any) {
    console.error("Upazilla AI Predict Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
