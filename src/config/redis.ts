import Redis from 'ioredis';
import { logger } from './logger';

const redisAddr = process.env.REDIS_ADDR || '';
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisDbNum = parseInt(process.env.REDIS_DB || '0', 10);

const [host, portStr] = (redisAddr || '127.0.0.1:6379').split(':');
const port = parseInt(portStr || '6379', 10);

export let redis: Redis | null = null;

export async function connectRedis() {
  if (!redisAddr) {
    logger.warn('REDIS_ADDR not set — running without Redis (caching disabled)');
    return;
  }

  try {
    logger.info(`Connecting to Redis at ${host}:${port} (DB: ${redisDbNum})...`);
    const client = new Redis({
      host,
      port,
      password: redisPassword,
      db: redisDbNum,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    redis = client;
    logger.info('Successfully connected to Redis');
  } catch (err) {
    logger.warn('Failed to connect to Redis — running without caching');
  }
}
