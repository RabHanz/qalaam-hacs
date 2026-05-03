# ADR-0009: Node/Fastify backend; Python only for ML/device-bridge

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation; minimizes language boundaries on the hot path)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

The Qalaam stack has natural language affinities:
- **TypeScript:** web frontend, mobile (React Native), API client SDKs, all UI packages, the standalone backend.
- **Python:** Home Assistant integration (HA is Python), ML inference (faster-whisper, transformers, F5-TTS), device-control sidecars (pychromecast, pyatv have no Node equivalent).

The temptation: write the SaaS backend in Python (FastAPI) for "consistency with HA + ML." This would put Python on the request hot path for every user action.

## Decision

We will write the SaaS backend in **Node 20 + Fastify v5 + TypeScript strict + Prisma v6**. Python is reserved for:
- The HA integration (`integrations/homeassistant`) — required by HA.
- ML workers (`services/asr-worker`, `services/tts-worker`, `services/prosody-worker`) — required by the model ecosystem.
- Device-bridge (`services/device-bridge`) — required by `pychromecast` / `pyatv`.
- ML training (`ml/training/`) — required by the framework ecosystem.

Inter-service communication: gRPC for hot-path low-latency (Node ↔ Python sidecars); HTTP/REST for everything else.

## Alternatives considered

1. **Python everywhere (FastAPI backend).** Tempting because it eliminates a language boundary with HA + ML. **Rejected because** the shared codebase between frontend (TS) and backend (TS) on a Node backend is much larger than the shared codebase between backend (Python) and ML workers (Python). The right place to absorb a language boundary is at the *worker* boundary (where async messaging is already required), not at the frontend↔backend boundary.

2. **TypeScript everywhere (Node ML).** **Rejected because** the modern Arabic TTS / Quranic ASR ecosystem is Python-first; Node ports lag by years and lack key models.

3. **Bun instead of Node.** Considered. **Rejected for now** because Fastify v5 + Prisma v6 are most battle-tested on Node; reconsider Bun for v2.0+ when ecosystem maturity catches up.

4. **Go for backend.** **Rejected because** loses the TS-shared-types dividend with the frontend; Go's ecosystem for our specific surface (Stripe, Supabase, Prisma) is weaker.

5. **Rust for backend.** **Rejected because** velocity cost outweighs perf gains at our stage; revisit if a specific hot path becomes a bottleneck.

## Consequences

### Positive

- Frontend devs and backend devs share TS idioms, types, tooling, and build pipelines.
- Fastify v5 + Prisma v6 is a battle-tested 2026 SaaS backend stack (per §20.6).
- Python sidecars only run when the model needs to — pay-for-what-you-use.

### Negative

- Two languages to lint, test, deploy, and observe.
- gRPC contract definitions duplicate some types (mitigated by ADR-0008 codegen producing both TS and Python types from JSON Schema).

### Neutral

- HA integration is unavoidably Python; we accept it as a sealed boundary.

## Risks & monitoring

- **Risk:** Python sidecars become a deployment bottleneck (slow Docker builds, big images). **Leading indicator:** sidecar image > 2 GB; cold-start > 30s. **Mitigation:** multi-stage builds; pre-warm pools.
- **Risk:** gRPC adds latency on the hot path. **Leading indicator:** end-to-end p95 > 200ms for ASR-driven UX. **Mitigation:** in-process embed via PyO3 or Node N-API for the worst cases.

## References

- Strategy doc: §3 Monorepo structure, §10 Open questions (backend stack), §20.6 Backend/SaaS stack delta
- External: fastify.io, prisma.io
- Related ADRs: ADR-0001 (monorepo), ADR-0003 (multi-protocol adapters), ADR-0005 (Python ASR)
