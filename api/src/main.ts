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

async function bootstrap() {
  await connectDatabase();

  startNotificationWorker();

  const app = createApp();

  app.listen(appConfig.server.port, () => {
    logger.info(`🚀 API running on port ${appConfig.server.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
