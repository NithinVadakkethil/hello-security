// bootstrap/app.ts

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { httpLogger } from '../common/logger/httpLogger';
import { errorHandler } from '../common/middleware/errorHandler';
import { notFound } from '../common/middleware/notFound';
import routes from '../routes';

export function createApp(): express.Express {
  const app = express();

  // Security & Request Parsing Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(httpLogger);

  // API Routes
  app.use('/api/v1', routes);

  // Fallback & Error Handlers
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
