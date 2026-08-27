import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  enableOfflineQueue: false,
});

// Suppress unhandled error events emitted by ioredis background reconnection attempts
redis.on('error', () => {
  // Errors are caught and logged inside health check
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (redis.status === 'wait' || redis.status === 'close' || redis.status === 'end') {
      await redis.connect();
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      console.log('✅ Redis connected');
      return true;
    }
    console.log(`❌ Redis connection failed: Unexpected ping response "${pong}"`);
    return false;
  } catch (error: any) {
    console.log(`❌ Redis connection failed: ${error.message || error}`);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
