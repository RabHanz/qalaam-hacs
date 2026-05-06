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

import { featureGuardPlugin } from './auth/feature-guard-plugin.js';
import { type Config, loadConfig } from './config.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { loggerPlugin } from './plugins/logger.js';
import { healthRoutes } from './routes/health.js';
import { mcpServerRoutes } from './routes/mcp-server.js';
import { authRoutes } from './routes/v1/auth.js';
import { bookmarksRoutes } from './routes/v1/bookmarks.js';
import { chaptersRoutes } from './routes/v1/chapters.js';
import { creditsRoutes } from './routes/v1/credits.js';
import { curriculumRoutes } from './routes/v1/curriculum.js';
import { familyRoutes } from './routes/v1/family.js';
import { featuresRoutes } from './routes/v1/features.js';
import { hifdhStateRoutes } from './routes/v1/hifdh-state.js';
import { hifdhRoutes } from './routes/v1/hifdh.js';
import { imageMushafRoutes } from './routes/v1/image-mushaf.js';
import { khatmRoutes } from './routes/v1/khatm.js';
import { mcpRoutes } from './routes/v1/mcp.js';
import { mistakesRoutes } from './routes/v1/mistakes.js';
import { morphologyRoutes } from './routes/v1/morphology.js';
import { nowPlayingRoutes } from './routes/v1/now-playing.js';
import { plansRoutes } from './routes/v1/plans.js';
import { prayerTimesRoutes } from './routes/v1/prayer-times.js';
import { qiblaHijriRoutes } from './routes/v1/qibla-hijri.js';
import { qpcTextRoutes } from './routes/v1/qpc-text.js';
import { qulLayoutsRoutes } from './routes/v1/qul-layouts.js';
import { qulMetadataRoutes } from './routes/v1/qul-metadata.js';
import { qulMutashabihatRoutes } from './routes/v1/qul-mutashabihat.js';
import { qulRecitationsRoutes } from './routes/v1/qul-recitations.js';
import { qulSurahInfoRoutes } from './routes/v1/qul-surah-info.js';
import { qulWbwRoutes } from './routes/v1/qul-wbw.js';
import { recitationsRoutes } from './routes/v1/recitations.js';
import { searchRoutes } from './routes/v1/search.js';
import { supportRoutes } from './routes/v1/support.js';
import { tajweedRoutes } from './routes/v1/tajweed.js';
import { topicsRoutes } from './routes/v1/topics.js';
import { translationsRoutes } from './routes/v1/translations.js';
import { transliterationsRoutes } from './routes/v1/transliterations.js';
import { versesRoutes } from './routes/v1/verses.js';
import { voiceNotesRoutes } from './routes/v1/voice-notes.js';

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
    // Per-IP cap. SSR pages routinely fan out 30-50 /v1/* calls per
    // user navigation (e.g. /read/2 hits translations × 286 verses,
    // recitations, image-mushaf resolver, surah-info, layouts, …).
    // 600/min was too tight — a single user reloading 3-4 times during
    // dev would bust it and surface as "Verse not found" downstream.
    // 6,000/min still throttles abuse but lets normal traffic through.
    max: 6_000,
    timeWindow: '1 minute',
    // localhost gets exempted entirely so dev tooling (Playwright, /
    // curl audits, multiple browser tabs against the same backend)
    // never trips the limit.
    allowList: ['127.0.0.1', '::1'],
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

  // Feature-gate hook — runs on every request before route handlers.
  // Closed-by-default for any /v1/* path that isn't catalogued in
  // ROUTE_RULES. See `apps/backend/src/auth/feature-guard-plugin.ts`
  // for the full rule table.
  await app.register(featureGuardPlugin);

  await app.register(healthRoutes);
  await app.register(versesRoutes, { config });
  await app.register(chaptersRoutes, { config });
  await app.register(recitationsRoutes, { config });
  await app.register(searchRoutes);
  await app.register(hifdhRoutes);
  await app.register(hifdhStateRoutes);
  await app.register(imageMushafRoutes);
  await app.register(nowPlayingRoutes);
  await app.register(prayerTimesRoutes);
  await app.register(qiblaHijriRoutes);
  await app.register(translationsRoutes);
  await app.register(transliterationsRoutes);
  await app.register(tajweedRoutes);
  await app.register(morphologyRoutes);
  await app.register(topicsRoutes);
  await app.register(mcpRoutes);
  await app.register(mcpServerRoutes);
  await app.register(curriculumRoutes);
  await app.register(creditsRoutes);
  await app.register(qulMetadataRoutes, { config });
  await app.register(qulMutashabihatRoutes, { config });
  await app.register(qulWbwRoutes, { config });
  await app.register(qulSurahInfoRoutes, { config });
  await app.register(qulLayoutsRoutes, { config });
  await app.register(qulRecitationsRoutes, { config });
  await app.register(qpcTextRoutes, { config });
  // Auth foundation (#192) — opens its own qalaam.sqlite for users +
  // sessions + bookmarks; doesn't touch the read-only qul.sqlite.
  await app.register(authRoutes);
  await app.register(bookmarksRoutes);
  // Family-tier (E1/E2/E5/E6) — also on qalaam.sqlite. Mistakes route
  // also reads from qul.sqlite for verse→page lookups.
  await app.register(familyRoutes);
  await app.register(plansRoutes);
  await app.register(mistakesRoutes, { config });
  await app.register(khatmRoutes);
  await app.register(voiceNotesRoutes);
  // H2 — billing/support intake (no Stripe yet — that lands in deploy commit).
  await app.register(supportRoutes);
  // Public feature catalog — frontend mirror reads this so we can
  // ship tier flips from the admin panel (#214) without redeploying.
  await app.register(featuresRoutes);

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
