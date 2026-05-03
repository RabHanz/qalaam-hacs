# `qalaam-backend`

Fastify v5 + Prisma v6 + PostgreSQL + Redis. Per ADR-0009 (Node) + ADR-0010 (Postgres + R2).

## Run

```bash
make docker-up           # postgres + redis
pnpm --filter qalaam-backend prisma:migrate
pnpm --filter qalaam-backend dev
```

## Structure

```
src/
├── server.ts                  # entry point
├── config.ts                  # env-validated config (Zod)
├── plugins/
│   ├── logger.ts              # pino + request-id correlation
│   ├── error-handler.ts       # RFC 9457 problem-detail responses
│   ├── prisma.ts              # Prisma client singleton
│   ├── auth.ts                # Supabase Auth (placeholder)
│   ├── rate-limit.ts
│   └── swagger.ts             # OpenAPI generation
├── routes/
│   ├── health.ts
│   └── v1/
│       └── verses.ts          # /v1/verses/by_key/:key
├── lib/
│   └── data-loader.ts         # singleton QUL reader
└── errors/
    └── problem.ts             # RFC 9457 ProblemDetail helpers
```

## Endpoints (v0.1)

- `GET /healthz` — liveness.
- `GET /v1/verses/by_key/:verseKey` — local QUL lookup; falls back to QF API.

Outcome served: O-01 (mistake-detection latency depends on fast verse lookup).
