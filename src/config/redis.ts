import Redis from 'ioredis';
import { logger } from './logger';

const redisAddr = process.env.REDIS_ADDR || '127.0.0.1:6379';
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisDbNum = parseInt(process.env.REDIS_DB || '0', 10);

const [host, portStr] = redisAddr.split(':');
const port = parseInt(portStr || '6379', 10);

export const redis = new Redis({
  host,
  port,
  password: redisPassword,
  db: redisDbNum,
  lazyConnect: true, // We will connect manually during bootstrap to check connection
});

export async function connectRedis() {
  try {
    logger.info(`Connecting to Redis at ${host}:${port} (DB: ${redisDbNum})...`);
    await redis.connect();
    await redis.ping();
    logger.info('Successfully connected to Redis');
  } catch (err) {
    logger.error('Failed to connect to Redis', err);
    process.exit(1);
  }
}
