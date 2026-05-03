/**
 * Centralized error handler — every 4xx/5xx response is RFC 9457.
 */
import fp from 'fastify-plugin';

import { problemFromError } from '../errors/problem.js';

export const errorHandlerPlugin = fp(async function (fastify) {
  fastify.setErrorHandler((err, request, reply) => {
    const { status, body } = problemFromError(err, request.url);
    request.log.error({ err, problem: body }, 'request failed');
    void reply.status(status).type('application/problem+json').send(body);
  });

  fastify.setNotFoundHandler((request, reply) => {
    void reply.status(404).type('application/problem+json').send({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No route ${request.method} ${request.url}`,
      instance: request.url,
    });
  });
});
