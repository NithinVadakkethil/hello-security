import { logger } from '../common/logger/logger';
import { prisma } from './prisma';

export async function connectDatabase() {
  await prisma.$connect();

  logger.info('✅ Database connected');
}

export async function disconnectDatabase() {
  await prisma.$disconnect();

  logger.info('🛑 Database disconnected');
}
