import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { createApp } from './bootstrap/app';
import { logger } from './common/logger/logger';
import { appConfig } from './config/app.config';
import { connectDatabase } from './database';
import { startNotificationWorker } from './workers/notification-worker';
import { mandatoryPatrolService } from './modules/mandatory-patrol/mandatory-patrol.service';

async function bootstrap() {
  await connectDatabase();

  startNotificationWorker();

  // Start background mandatory patrol status evaluator (runs every 60s)
  setInterval(() => {
    mandatoryPatrolService.evaluateMandatoryPatrolStatuses().catch((err: any) => {
      logger.error(`Error evaluating mandatory patrol statuses: ${err.message}`);
    });
  }, 60000);

  const app = createApp();

  app.listen(appConfig.server.port, () => {
    logger.info(`🚀 API running on port ${appConfig.server.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
