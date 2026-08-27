import { checkPostgresConnection } from '../database/postgres.client';
import { checkRedisConnection } from '../database/redis.client';

export interface SystemHealthResult {
  postgres: boolean;
  redis: boolean;
}

/**
 * Checks system health for PostgreSQL and Redis connections.
 * Logs success or failure status for each service without throwing errors.
 */
export async function checkSystemHealth(): Promise<SystemHealthResult> {
  console.log('─── System Health Check ───────────────────────');

  const [postgresHealthy, redisHealthy] = await Promise.all([
    checkPostgresConnection(),
    checkRedisConnection(),
  ]);

  return {
    postgres: postgresHealthy,
    redis: redisHealthy,
  };
}
