import pinoHttp from 'pino-http';
import { logger } from './logger';

export const httpLogger = pinoHttp({
  logger,

  autoLogging: true,

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
