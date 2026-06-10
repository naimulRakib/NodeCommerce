import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the same trigger logic as the super dashboard
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const triggerRes = await fetch(`${protocol}://${host}/api/aco/trigger`, {
      method: "POST"
    });

    if (!triggerRes.ok) {
      throw new Error("Failed to trigger ACO run");
    }

    const data = await triggerRes.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
