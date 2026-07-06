import { env } from './env';

export const appConfig = {
  app: {
    name: 'Hello Security',
    version: '1.0.0',
    env: env.NODE_ENV,
  },

  server: {
    port: env.PORT,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  },

  bcrypt: {
    saltRounds: env.BCRYPT_ROUNDS,
  },
} as const;
