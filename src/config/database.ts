import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Solve BigInt serialization issue in Express JSON responses
(BigInt.prototype as any).toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Successfully connected to PostgreSQL database via Prisma');
  } catch (err) {
    logger.error('Failed to connect to database', err);
    process.exit(1);
  }
}
