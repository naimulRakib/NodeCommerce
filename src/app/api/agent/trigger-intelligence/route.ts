import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { inngest } from '@/inngest/client';

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    console.log("[Intelligence] Triggering LangGraph Pipeline via Inngest...");
    
    // Dispatch the event to Inngest
    await inngest.send({
      name: "ai/trigger.intelligence",
      data: { triggeredBy: user.id }
    });

    return NextResponse.json({
      success: true,
      message: "Intelligence pipeline queued successfully. Check logs for progress."
    }, { status: 202 });
  } catch (err: any) {
    console.error("[Intelligence] Error queuing pipeline:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
