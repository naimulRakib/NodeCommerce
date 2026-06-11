import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryStrategy: () => null // Prevent crashing during Next.js builds if Redis is offline
  });

redis.on('error', (err) => console.warn('Redis Connection Error:', err.message));

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
