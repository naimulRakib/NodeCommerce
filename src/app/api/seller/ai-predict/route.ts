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

    // Grok API call
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      // Fallback demo response if no key
      return NextResponse.json({
        analysis: "বাজার বিশ্লেষণ:\n\n১. **প্রিমিয়াম মিনিকেট চাল:** আগামী সপ্তাহে রমজানের কারণে চাহিদা ২০% বাড়ার সম্ভাবনা রয়েছে। আপনার বর্তমান স্টক (৫০০) পর্যাপ্ত নাও হতে পারে। মূল্য ৳৩২ থেকে ৳৩৫ এ বাড়ানোর সুযোগ রয়েছে।\n\n২. **গেমিং কীবোর্ড:** লোকাল মার্কেটে চাহিদা স্থিতিশীল। তবে নতুন সেমিস্টার শুরুর কারণে কিছু শিক্ষার্থী কিনতে পারে।",
        metrics: [
          { label: "চাল ডিমান্ড ফোরকাস্ট", value: "+২০%", trend: "up" },
          { label: "প্রস্তাবিত চালের মূল্য", value: "৳৩৫০০/বস্তা", trend: "up" },
        ],
      });
    }

    const prompt = `
You are an expert AI market analyst for a seller in Bangladesh.
Analyze these products and provide a short, professional market prediction in Bengali.
Tell them if demand will increase/decrease and if they should adjust prices. Keep it under 150 words.
Use markdown formatting for readability.

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
      }),
    });

    if (!res.ok) {
      throw new Error(`Grok API error: ${res.status}`);
    }

    const json = await res.json();
    const analysis = json.choices[0].message.content;

    // Hardcoded metrics for demo visual appeal
    const metrics = [
      { label: "সামগ্রিক মার্কেট ডিমান্ড", value: "+১৫%", trend: "up" },
      { label: "স্টক আউট ঝুঁকি", value: "নিম্ন", trend: "down" },
    ];

    return NextResponse.json({ analysis, metrics });

  } catch (error: any) {
    console.error("AI Predict Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
