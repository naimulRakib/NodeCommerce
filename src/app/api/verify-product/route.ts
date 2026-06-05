import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Simple mock logic: if price is very low, mock a rejection
    if (data.price && Number(data.price) < 10) {
      return NextResponse.json({
        status: "rejected",
        reason: "Price is suspiciously low for this category.",
      });
    }

    // Default to approved
    return NextResponse.json({
      status: "approved",
    });
  } catch (error) {
    return NextResponse.json(
      { status: "rejected", reason: "Invalid data format" },
      { status: 400 }
    );
  }
}
