import dotenv from 'dotenv';
// Load environment variables before importing configs
dotenv.config();

// Set global process timezone matching Go's Asia/Kolkata
process.env.TZ = 'Asia/Kolkata';

import app from './app';
import { connectDatabase, prisma } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './config/logger';

const portRaw = process.env.PORT || '8080';
// Go port includes leading colon, e.g. ":8080"
const port = parseInt(portRaw.replace(':', ''), 10) || 8080;

async function bootstrap() {
  // Connect to DB and Redis
  await connectDatabase();
  await connectRedis();

  const server = app.listen(port, () => {
    logger.info(`Server started on port :${port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down server gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await prisma.$disconnect();
        logger.info('Prisma disconnected.');
      } catch (err) {
        logger.error('Error disconnecting Prisma', err);
      }

      try {
        if (redis) {
          await redis.quit();
          logger.info('Redis connection closed.');
        }
      } catch (err) {
        logger.error('Error closing Redis', err);
      }

      logger.info('Graceful shutdown completed. Exiting.');
      process.exit(0);
    });

    // Force shutdown after 10s if connections hang
    setTimeout(() => {
      logger.warn('Forcing immediate shutdown after 10s limit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal('Bootstrap failure', err);
  process.exit(1);
});
