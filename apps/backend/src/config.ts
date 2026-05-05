/**
 * Environment configuration — validated at startup. Fail-loud on missing/invalid.
 *
 * Per CLAUDE.md §11.2: no secrets in code; all config via env. The app refuses
 * to start if required vars are missing.
 */
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Local data substrate
  QUL_SQLITE_PATH: z.string().default('data/qul.sqlite'),

  // Quran.Foundation (Tier A — M2M)
  QF_BASE_URL: z.string().url().default('https://apis.quran.foundation'),
  QF_OAUTH_URL: z.string().url().default('https://oauth2.quran.foundation'),
  QF_CLIENT_ID: z.string().optional(),
  QF_CLIENT_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Refusing to start: invalid env. See errors above.');
  }
  return parsed.data;
}
