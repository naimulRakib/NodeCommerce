import Redis from 'ioredis';
import { REDIS_URL, IS_PRODUCTION } from '@/lib/env';

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: () => null // Prevent crashing during Next.js builds if Redis is offline
  });

redis.on('error', (err: any) => {
  if (err.code !== 'ECONNREFUSED' && !err.message?.includes('Connection is closed')) {
    console.warn('Redis Connection Error:', err.message);
  }
});

if (!IS_PRODUCTION) globalForRedis.redis = redis;
