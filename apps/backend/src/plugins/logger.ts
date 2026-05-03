/**
 * Pino logger plugin with request-id correlation. Per CLAUDE.md §11.2:
 * structured logging only; no console.log.
 */
import { randomUUID } from 'node:crypto';

import fp from 'fastify-plugin';
import pino, { type Logger } from 'pino';

import type { Config } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export const loggerPlugin = fp(async function (fastify, opts: { config: Config }) {
  const baseLogger: Logger = pino({
    level: opts.config.LOG_LEVEL,
    base: { app: 'qalaam-backend', env: opts.config.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(opts.config.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
        }
      : {}),
  });
  fastify.log = baseLogger as unknown as typeof fastify.log;

  fastify.addHook('onRequest', async (request) => {
    const id = (request.headers['x-request-id'] as string) ?? randomUUID();
    request.requestId = id;
    request.log = baseLogger.child({ reqId: id }) as unknown as typeof request.log;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        elapsedMs: reply.elapsedTime,
      },
      'request',
    );
  });
});
