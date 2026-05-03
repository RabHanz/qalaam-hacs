# Runbook — ASR battery drain on mobile

## Symptom

Users on mobile (iOS/Android) report battery drops > 5%/hour during a Hifdh session. Per §26.3 leading indicator, this triggers a SEV-3.

## Likely cause

1. `faster-whisper` running without VAD gating — the model burns CPU on silence.
2. Audio buffer too long → model invoked too frequently.
3. CPU thermal throttling on older devices forces the OS to over-allocate.
4. Wake-lock acquired and not released between sessions.

## Diagnosis

```bash
# Inspect the mobile worker's active session metrics (post v1.5 telemetry)
curl -s http://device.local:5001/v1/metrics | jq '.asr.cpu_percent_p95'

# On Android: adb battery stats
adb shell dumpsys batterystats | grep -A 5 com.qalaam.app

# On iOS: Xcode → Energy gauge
```

## Mitigation

**Short-circuit:** in the mobile app, disable on-device ASR for the affected session and fall back to manual rating. This is one toggle in Settings → Hifdh → "Use AI listener" (default ON; users can flip OFF).

**Quick fix:** raise the VAD confidence threshold in the worker's env (`VAD_THRESHOLD=0.7` → `0.85`) to reduce false-positive activations.

```bash
docker compose -f docker-compose.dev.yml \
  -e VAD_THRESHOLD=0.85 up -d asr-worker
```

## Long-term fix

- Switch from `whisper-base-ar-quran` (74M params) to `whisper-tiny-ar-quran` (39M) on devices flagged as battery-constrained (heuristic: < iPhone 13 / Snapdragon 7 Gen 1).
- Add explicit VAD gate (e.g., `silero-vad`) to the streaming path so the model never runs on silence.
- Per CLAUDE.md §11.2: instrument battery percentage delta per session (one of §26.3 leading indicators).

## Outcome impacted

- O-02 (false-positive reduction — ironically degraded by aggressive VAD).
- O-03 (offline Hifdh — battery is the offline budget).
- O-11 (theological soundness — users disabling AI listener loses the mistake-detection capability).
