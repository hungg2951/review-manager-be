import { checkSystemHealth } from './health-check';
import * as postgresClient from '../database/postgres.client';
import * as redisClient from '../database/redis.client';

describe('checkSystemHealth', () => {
  let pgSpy: jest.SpyInstance;
  let redisSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return health status true when both Postgres and Redis are healthy', async () => {
    pgSpy = jest.spyOn(postgresClient, 'checkPostgresConnection').mockResolvedValue(true);
    redisSpy = jest.spyOn(redisClient, 'checkRedisConnection').mockResolvedValue(true);

    const result = await checkSystemHealth();

    expect(result).toEqual({ postgres: true, redis: true });
    expect(pgSpy).toHaveBeenCalledTimes(1);
    expect(redisSpy).toHaveBeenCalledTimes(1);
  });

  it('should return health status false for unhealthy services without crashing', async () => {
    pgSpy = jest.spyOn(postgresClient, 'checkPostgresConnection').mockResolvedValue(false);
    redisSpy = jest.spyOn(redisClient, 'checkRedisConnection').mockResolvedValue(false);

    const result = await checkSystemHealth();

    expect(result).toEqual({ postgres: false, redis: false });
  });
});
