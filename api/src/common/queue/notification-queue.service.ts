import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { logger } from '../logger/logger';
import { processCompletedPatrolNotification } from '../../workers/notification-worker';

export const COMPLETED_PATROL_QUEUE_NAME = 'completed-patrol-notifications';

export class NotificationQueueService {
  private queue: Queue | null = null;
  private redisConnection: Redis | null = null;

  constructor() {
    try {
      if (redisConfig.url) {
        this.redisConnection = new Redis(redisConfig.url, {
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });

        this.queue = new Queue(COMPLETED_PATROL_QUEUE_NAME, {
          connection: this.redisConnection as any,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
        logger.info(`🔄 Redis Notification Queue initialized on: ${redisConfig.url}`);
      }
    } catch (err: any) {
      logger.warn(`⚠️ Redis queue initialization error: ${err.message}. Falling back to async process handler.`);
    }
  }

  async enqueueCompletedPatrol(patrolSessionId: string, clientId: string): Promise<void> {
    try {
      if (this.queue) {
        await this.queue.add('send-completed-patrol-email', {
          patrolSessionId,
          clientId,
        });
        logger.info(`📥 Queued completed patrol notification job for session ${patrolSessionId}`);
        return;
      }
    } catch (err: any) {
      logger.warn(`⚠️ Failed to push job to Redis queue: ${err.message}. Running async fallback process.`);
    }

    // Async non-blocking fallback execution if Redis Queue unavailable
    setImmediate(() => {
      processCompletedPatrolNotification(patrolSessionId, clientId).catch((err) => {
        logger.error(`❌ Notification worker process failed: ${err.message}`);
      });
    });
  }
}

export const notificationQueueService = new NotificationQueueService();
