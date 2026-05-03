# `@qalaam/adapter-mqtt`

MQTT-topic adapter — pairs Qalaam with any MQTT-aware speaker (ESPHome `media_player`, Snapcast, custom DIY).

## Topic schema

| Direction | Topic | Payload |
|---|---|---|
| → speaker | `qalaam/speaker/{external_id}/play` | `{ "url": "...", "verseKey": "1:1" }` |
| → speaker | `qalaam/speaker/{external_id}/pause` | `{}` |
| → speaker | `qalaam/speaker/{external_id}/resume` | `{}` |
| → speaker | `qalaam/speaker/{external_id}/seek` | `{ "position_ms": 12345 }` |
| → speaker | `qalaam/speaker/{external_id}/volume` | `{ "level": 0.7 }` |
| ← speaker | `qalaam/speaker/{external_id}/state` | `{ "status": "playing", "position_ms": ... }` |
| ← speaker | `qalaam/speaker/{external_id}/announce` | broadcast announce; speaker auto-restores |

Per ADR-0003. ~50 LoC of glue per the strategy delta.
