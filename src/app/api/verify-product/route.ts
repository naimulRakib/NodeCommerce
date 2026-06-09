import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { verifyWithOllama } from '@/lib/ollama';

// In-memory rate limiter
const rateLimit = new Map<string, number[]>();
let isVerifying = false; // In-flight request guard

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const requests = rateLimit.get(userId) ?? [];
  const recent = requests.filter((t) => now - t < 60000); // last 60s
  if (recent.length >= 5) return true;
  rateLimit.set(userId, [...recent, now]);
  return false;
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { status: "rejected", reason: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (isVerifying) {
      return NextResponse.json(
        { status: "busy", message: "Verification in progress, try again" },
        { status: 429 }
      );
    }

    const data = await request.json();
    isVerifying = true;

    try {
      // Mock logic: if price is very low, mock a rejection
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

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn("Ollama AI verification timed out, falling back to manual review.");
        return NextResponse.json({
          status: "manual_review",
          reason: "AI verification timed out.",
        });
      }
      throw err; // Let outer try/catch handle it
    } finally {
      isVerifying = false;
    }

  } catch (error) {
    isVerifying = false;
    console.error("Verification failed:", error);
    return NextResponse.json(
      { status: "rejected", reason: "Invalid data format or internal error" },
      { status: 500 }
    );
  }
}
