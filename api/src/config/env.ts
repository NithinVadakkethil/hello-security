import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES_IN: z.string().default('24h'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  JWT_ISSUER: z.string().default('hello-security'),

  JWT_AUDIENCE: z.string().default('hello-security-api'),

  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
});

export const env = envSchema.parse(process.env);
