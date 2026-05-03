# `qalaam-prosody-worker`

Python batch worker for prosody analysis at scale — for fine-tuning datasets, eval pipelines, and any offline workload that's heavier than the browser AudioWorklet should carry. Per **ADR-0009** + strategy §8.5.

## Why a separate Python service

The pure-TS `@qalaam/prosody` library covers the live (sub-200 ms) feedback loop in the browser AudioWorklet. For batch jobs (computing F0/energy/MFCC across the whole EveryAyah dataset, comparing a user's recording to a reciter's prosody contour) we want numpy + (eventually) librosa.

The Python service is **stateless** — file in, signals out, nothing persisted. Same privacy posture as the ASR worker: never run against user audio that hasn't been explicitly opted into the data flywheel.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/healthz` | Liveness |
| `POST` | `/v1/analyze` | Multipart audio upload → prosody features (F0 contour, energy envelope, MFCC means) |
| `POST` | `/v1/compare` | Two uploads → DTW distance + per-frame alignment |

## Status

v0.1 ships skeleton endpoints with deterministic stubs so the API surface is exercisable. v2.0 wires real numpy/librosa computation alongside the TTS fine-tuning pipeline.
