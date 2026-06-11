import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/uipath/jobs
 * Returns all MockUiPathJob records, newest first.
 * Used by the Super Admin dashboard to show live UiPath job status.
 */
export async function GET() {
  try {
    const jobs = await prisma.mockUiPathJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("[UiPath Jobs] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
