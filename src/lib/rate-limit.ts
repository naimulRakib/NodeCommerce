import { redis } from './redis';

export async function rateLimit(identifier: string, limit: number, windowMs: number) {
  const key = `ratelimit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }

  return {
    success: current <= limit,
    limit,
    remaining: Math.max(0, limit - current),
    reset: Date.now() + windowMs,
  };
}
