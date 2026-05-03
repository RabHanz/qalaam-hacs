# Runbook — TTS provider fail-over

## Symptom

`/v1/synthesize` returns 502, or `audioUrl` returns 5xx when the web client tries to play. Users see "Couldn't generate audio" in the recite UI.

## Likely cause

1. ElevenLabs (default per ADR-0014) is rate-limiting or returning 5xx.
2. ElevenLabs API key was rotated and the env wasn't updated.
3. The `qalaam-house` voice id was deleted from the ElevenLabs account.
4. Cloudflare R2 audio-cache write failed (downstream of ElevenLabs response).

## Diagnosis

```bash
# Confirm provider is up and responsive
curl -s https://api.elevenlabs.io/v1/user | jq .subscription.character_count

# Check Qalaam tts-worker logs
docker compose logs tts-worker --tail=200 | grep -i 'failed'

# Verify the voice is live
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices/$ELEVENLABS_VOICE_ID_QALAAM_HOUSE" | jq .name
```

## Mitigation

**Immediate (≤ 5 min):** flip the provider switch.

```bash
# Switch active provider to the secondary (Inworld TTS-1.5 once configured)
docker compose -f docker-compose.dev.yml \
  -e TTS_PROVIDER=inworld up -d tts-worker

# Or for prod, push a config change:
kubectl set env deployment/tts-worker TTS_PROVIDER=inworld
kubectl rollout restart deployment/tts-worker
```

**Short-term (≤ 1 hour):** if ElevenLabs is down, the cache hit rate (≥ 60% per §26.5) keeps most listeners served. Verify the cache is healthy:

```bash
redis-cli -h $REDIS_URL --raw INFO stats | grep keyspace
```

## Long-term fix

- Wire **provider abstraction** for genuinely-multiple providers (`elevenlabs`, `inworld`, `habibi-self-host`). Per ADR-0014 the swap is one-line; today it's not actually wired for `inworld` yet — track as v0.5 work.
- Pre-generate top-1000 verses (vs top-100 today) — pushes cache hit to ~80%, decoupling outage exposure.
- Self-host Habibi at break-even (~5K active users per ADR-0014).

## Outcome impacted

- O-06 (reciter voice synthesis). Acceptable degradation: ≤ 1 hour fully-down per user; > 1 hour triggers a status-page incident.
