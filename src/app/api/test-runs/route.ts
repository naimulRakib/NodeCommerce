import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    // Create the global run
    const testRun = await prisma.testRun.create({
      data: {
        id: payload.testRunId,
        environment: payload.environment || "staging",
        status: payload.status || "completed",
        totalTests: payload.totalTests || 0,
        passed: payload.passed || 0,
        failed: payload.failed || 0,
        skipped: payload.skipped || 0,
        timedOut: payload.timedOut || 0,
        durationMs: payload.durationMs || 0,
        results: {
          create: payload.results?.map((res: any) => ({
            testCaseId: res.testCaseId,
            name: res.name,
            status: res.status,
            durationMs: res.durationMs,
            errorMessage: res.errorMessage || null,
          })) || []
        }
      }
    });

    return NextResponse.json({ success: true, testRun });
  } catch (error) {
    console.error("Error storing test run:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
