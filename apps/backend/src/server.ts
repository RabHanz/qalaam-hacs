/**
 * Qalaam backend — Fastify v5 entry point.
 * Per ADR-0009.
 */
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';

import { type Config, loadConfig } from './config.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { loggerPlugin } from './plugins/logger.js';
import { healthRoutes } from './routes/health.js';
import { chaptersRoutes } from './routes/v1/chapters.js';
import { curriculumRoutes } from './routes/v1/curriculum.js';
import { hifdhStateRoutes } from './routes/v1/hifdh-state.js';
import { hifdhRoutes } from './routes/v1/hifdh.js';
import { nowPlayingRoutes } from './routes/v1/now-playing.js';
import { qulLayoutsRoutes } from './routes/v1/qul-layouts.js';
import { qulMetadataRoutes } from './routes/v1/qul-metadata.js';
import { qulMutashabihatRoutes } from './routes/v1/qul-mutashabihat.js';
import { qulRecitationsRoutes } from './routes/v1/qul-recitations.js';
import { qulSurahInfoRoutes } from './routes/v1/qul-surah-info.js';
import { qulWbwRoutes } from './routes/v1/qul-wbw.js';
import { recitationsRoutes } from './routes/v1/recitations.js';
import { translationsRoutes } from './routes/v1/translations.js';
import { versesRoutes } from './routes/v1/verses.js';

export async function build(config: Config = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we install pino in loggerPlugin
    disableRequestLogging: true,
    bodyLimit: 1 * 1024 * 1024, // 1 MiB — Hifdh sync envelopes are small
    trustProxy: true,
  });

  await app.register(loggerPlugin, { config });
  await app.register(errorHandlerPlugin);
  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: false, // owned by `apps/web`
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: config.PUBLIC_APP_URL === '*' ? true : [config.PUBLIC_APP_URL],
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Qalaam API',
        version: '0.0.1',
        description:
          'Qalaam SaaS backend. See Docs/STRATEGY_AND_ROADMAP.md for context. Errors are RFC 9457 problem-detail responses with stable `code` fields.',
      },
      servers: [{ url: config.PUBLIC_API_URL }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(healthRoutes);
  await app.register(versesRoutes, { config });
  await app.register(chaptersRoutes, { config });
  await app.register(recitationsRoutes, { config });
  await app.register(hifdhRoutes);
  await app.register(hifdhStateRoutes);
  await app.register(nowPlayingRoutes);
  await app.register(translationsRoutes);
  await app.register(curriculumRoutes);
  await app.register(qulMetadataRoutes, { config });
  await app.register(qulMutashabihatRoutes, { config });
  await app.register(qulWbwRoutes, { config });
  await app.register(qulSurahInfoRoutes, { config });
  await app.register(qulLayoutsRoutes, { config });
  await app.register(qulRecitationsRoutes, { config });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await build(config);

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error({ err }, 'startup failed');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await main();
}
