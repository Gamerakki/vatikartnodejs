import dotenv from 'dotenv';
// Load environment variables before importing configs
dotenv.config();

// Set global process timezone matching Go's Asia/Kolkata
process.env.TZ = 'Asia/Kolkata';

import app from './app';
import { connectDatabase, prisma } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './config/logger';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

type JoinCompanyRoomPayload = {
  companyId: number | string;
};

type StorefrontActivityPayload = {
  companyId: number | string;
  activityType: 'view_catalog' | 'view_product';
  label: string;
  timestamp: string;
};

const portRaw = process.env.PORT || '8080';
// Go port includes leading colon, e.g. ":8080"
const port = parseInt(portRaw.replace(':', ''), 10) || 8080;

async function bootstrap() {
  // Connect to DB and Redis
  await connectDatabase();
  await connectRedis();

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '').split(','),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: process.env.ALLOW_CREDENTIALS !== 'false',
    },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_company_room', ({ companyId }: JoinCompanyRoomPayload) => {
      if (!companyId) return;
      socket.join(`company:${companyId}`);
    });

    socket.on('storefront_activity', (payload: StorefrontActivityPayload) => {
      if (!payload?.companyId) return;
      io.to(`company:${payload.companyId}`).emit('storefront_activity', payload);
    });
  });

  const server = httpServer.listen(port, () => {
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

  // Self-ping to prevent Render from sleeping (every 14 minutes)
  const PING_INTERVAL = 14 * 60 * 1000;
  const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  
  setInterval(() => {
    logger.info(`Self-pinging ${selfUrl}/robots.txt to keep server awake...`);
    fetch(`${selfUrl}/robots.txt`)
      .then(res => logger.info(`Self-ping status: ${res.status}`))
      .catch(err => logger.error(`Self-ping failed`, err));
  }, PING_INTERVAL);

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal('Bootstrap failure', err);
  process.exit(1);
});
