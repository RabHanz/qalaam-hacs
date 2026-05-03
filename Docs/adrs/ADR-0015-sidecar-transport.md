# ADR-0015: Sidecar transport — HTTP/JSON v0.1, gRPC v1.0

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation; impacts O-01 latency budget for ASR)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Per ADR-0009, Qalaam runs Python sidecars for protocols Node can't speak well
(`device-bridge` for Cast/AirPlay, `asr-worker`, `tts-worker`,
`realtime-feedback`). Each sidecar exposes a REST/JSON surface today.

The architecture target is gRPC for hot paths (Node ↔ ASR worker), but in v0.1
we want zero protobuf tooling overhead while we're shaping the contracts.

Latency budget per §26 success metrics:
- Verse lookup (Node-only): ≤ 5ms p95
- Backend → ASR (verse-pause drill): ≤ 100ms RPC overhead p95
- Backend → device-bridge (Cast play): ≤ 200ms p95

JSON-over-HTTP RPC overhead: ~5-15ms locally (negligible vs the model
inference cost). gRPC saves ~30% of that — meaningful at scale, not at v0.1.

## Decision

- **v0.1 - v0.5:** all sidecars expose **HTTP + JSON** via FastAPI. Pydantic
  models on both sides; OpenAPI auto-generated for docs.
- **v1.0:** migrate `asr-worker` and `realtime-feedback` to **gRPC** (protobuf
  schemas under `services/<svc>/proto/`). Other sidecars stay HTTP/JSON until a
  hot-path metric demands the change.
- The contracts themselves (request/response shapes) stay codegened from
  `packages/schema/schemas/api/` so the migration is mechanical.

## Alternatives considered

1. **gRPC from day 0.** Tempting for low-latency. **Rejected** because (a) protobuf
   tooling overhead while contracts are still moving; (b) JSON traces are easier
   to debug; (c) zero observable latency cost at v0.1's scale.

2. **Pure in-process (Node ↔ Python via `node-calls-python` or PyO3).**
   **Rejected** because the deployment-flexibility cost is too high — running
   sidecars as separate processes is what enables the user to run ASR on a
   different LAN node from the backend (per ADR-0005 privacy posture).

3. **Message bus (NATS / Redis Streams).** **Rejected** for the request/response
   patterns we need; revisit when we add fan-out workloads (e.g., batch
   prosody analysis).

## Consequences

### Positive

- Zero protobuf toolchain to learn for v0.1.
- OpenAPI / Swagger UI for free at every sidecar.
- HTTP/JSON traces visible in any observability tool.
- Migration path to gRPC documented and deferred safely.

### Negative

- 5-15ms RPC overhead vs theoretical floor.
- HTTP/JSON has higher per-request CPU than gRPC at scale.

### Neutral

- Two transports in the codebase post-v1.0 (gRPC for hot paths, HTTP/JSON for
  control-plane). Acceptable trade-off; documented here.

## Risks & monitoring

- **Risk:** ASR latency budget regresses past 100ms RPC overhead. **Leading
  indicator:** Datadog/Grafana p95 trace span for `realtime-feedback ↔
  asr-worker`. **Mitigation:** accelerate the gRPC migration if breached.
- **Risk:** OpenAPI drift from `packages/schema`. **Mitigation:** the codegen
  pipeline already produces both; CI gate enforces.

## References

- Strategy doc: §6.2 (AI architecture stack), §10 (services/)
- Related ADRs: ADR-0008 (schema source of truth), ADR-0009 (backend language),
  ADR-0005 (privacy boundary)
