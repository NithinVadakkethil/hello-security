import { createApp } from './bootstrap/app';
import { logger } from './common/logger/logger';
import { appConfig } from './config/app.config';
import { connectDatabase } from './database';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();

  app.listen(appConfig.server.port, () => {
    logger.info(`🚀 API running on port ${appConfig.server.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
