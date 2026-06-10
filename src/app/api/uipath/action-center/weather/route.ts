import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // Simulate real-time weather API call
    // Return standard weather string
    
    // Simulate API delay
    await new Promise(r => setTimeout(r, 800));

    // Optional: read a query param to force fail for testing
    const { searchParams } = new URL(req.url);
    if (searchParams.get("fail") === "true") {
      return NextResponse.json({ error: "Weather API Unavailable" }, { status: 503 });
    }

    return NextResponse.json({ weather: "Heavy Rain (Monsoon Warning)" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
