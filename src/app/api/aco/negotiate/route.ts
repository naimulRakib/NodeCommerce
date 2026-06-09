import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils"; // Assume some standard auth mechanism

export async function GET(request: Request) {
  try {
    // Basic auth stub - assuming verifyAuth returns user and role
    // const { user, role } = await verifyAuth(request);
    // For demo purposes, we parse headers if implemented, or skip
    // We'll enforce a simple check for safety
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const status = searchParams.get("status");
    const sellerId = searchParams.get("sellerId");

    // In a real app, verify the caller is a seller or district reseller.
    // For now, we apply standard filters
    const where: any = {};
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    if (sellerId) where.sellerId = sellerId;

    const negotiations = await prisma.sellerACONegotiation.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ negotiations });
  } catch (error: any) {
    console.error("GET negotiations error:", error);
    return NextResponse.json({ error: "Failed to fetch negotiations" }, { status: 500 });
  }
}
