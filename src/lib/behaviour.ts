import { prisma } from "@/lib/prisma";

/**
 * In-memory dedupe so a chatty client can't spam-track the same event
 * type from the same buyer. Resets on process restart, which is fine —
 * this is only meant to dampen click-storms, not enforce a hard quota.
 */
const recentEvents = new Map<string, number>();
const RATE_WINDOW_MS = 250;

function rateKey(buyerId: string, type: string) {
  return `${buyerId}:${type}`;
}

function shouldTrack(buyerId: string, type: string): boolean {
  const key = rateKey(buyerId, type);
  const last = recentEvents.get(key) ?? 0;
  const now = Date.now();
  if (now - last < RATE_WINDOW_MS) {
    return false;
  }
  recentEvents.set(key, now);
  // Prune the map occasionally so it can't grow unbounded.
  if (recentEvents.size > 1000) {
    const cutoff = now - RATE_WINDOW_MS * 10;
    for (const [k, ts] of recentEvents) {
      if (ts < cutoff) recentEvents.delete(k);
    }
  }
  return true;
}

/**
 * Fire-and-forget behaviour tracker. NEVER throws to the caller — behaviour
 * logging must never break a real user request. Failures are logged via
 * `console.warn` (not `error`) so monitoring can tell them apart from
 * actual application errors.
 */
export async function trackBehaviour(
  buyerId: string | null,
  type: string,
  payload: any,
): Promise<void> {
  if (!buyerId) return;

  try {
    if (!shouldTrack(buyerId, type)) return;

    // Detached from the request lifecycle. We intentionally do NOT
    // pre-check buyerProfile existence — the FK on buyerBehaviour.buyerId
    // will fail loudly with P2003 if the buyer was deleted between request
    // and write, which is the correct error path to surface.
    Promise.resolve()
      .then(async () => {
        await prisma.buyerBehaviour.create({
          data: { buyerId, type, payload: payload ?? {} },
        });
      })
      .catch((err) => {
        // Prisma FK violation means the buyer is gone — fine.
        if (err?.code === "P2003") return;
        console.warn("[behaviour] async track failed:", err);
      });
  } catch (err) {
    console.warn("[behaviour] sync track failed:", err);
  }
}
