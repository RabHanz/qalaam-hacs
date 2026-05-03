# `qalaam-device-bridge`

Python sidecar that hosts the protocols Node can't (well) speak: **Cast** (pychromecast) and **AirPlay 2** (pyatv). Per ADR-0003 + ADR-0009.

The Node backend (`apps/backend`) talks to this service over local HTTP/JSON in v0.1; we move to gRPC in v1.0 once the contract stabilizes.

## Endpoints (v0.1)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/healthz` | Liveness |
| `GET`  | `/v1/cast/discover` | Yield Cast devices on the LAN (mDNS) |
| `POST` | `/v1/cast/play` | `{ device_id, url, opts }` → play |
| `POST` | `/v1/cast/pause` | `{ device_id }` |
| `POST` | `/v1/cast/resume` | `{ device_id }` |
| `POST` | `/v1/cast/announce` | `{ device_id, url, duck }` (announce + restore) |
| `GET`  | `/v1/airplay/discover` | Yield AirPlay devices |
| `POST` | `/v1/airplay/play` | `{ device_id, url, opts }` |

The TS-side `Adapter` implementations in `packages/adapters-ts/cast` and `packages/adapters-ts/airplay` (v1.0) consume this REST contract.

## Why a sidecar

`pychromecast` and `pyatv` are the only well-maintained options for their respective protocols — both Python. Rather than re-implement, we run a tiny isolated process. Image is < 200 MB; cold start < 5s.
