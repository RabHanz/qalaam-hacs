# Qalaam — Home Assistant Integration

Per ADR-0003: HA is one of many adapters; the integration is a thin shim that
re-exposes Qalaam capabilities to HA users (`media_player`, `media_source`,
sensors, todo, calendar, button, select, services, custom Voice intents,
Lovelace panel). The standalone Qalaam SaaS / self-host install works without HA.

## Install (HACS)

1. HACS → Integrations → custom repo: `https://github.com/qalaam-org/qalaam`
   (category: Integration).
2. Install "Qalaam".
3. Restart HA.
4. Settings → Devices & Services → Add Integration → "Qalaam" → enter your
   Qalaam API key + base URL (default `https://api.qalaam.app`).

## What you get (v1)

| Surface | Entity / target |
|---|---|
| `media_player.qalaam` | Single Qalaam player; routes `play_media` to a target media_player chosen in Options. |
| `media-source://qalaam/...` | Browseable Quran library (reciter → surah → ayah). |
| `sensor.qalaam_current_verse` | String of the verse currently playing. |
| `sensor.qalaam_streak_days` | Hifdh streak (TOTAL_INCREASING). |
| `sensor.qalaam_next_prayer` | TIMESTAMP — next prayer window start. |
| `sensor.qalaam_today_session_count` | How many portions are due today. |
| `binary_sensor.qalaam_is_reciting` | True while a Qalaam verse is playing. |
| `binary_sensor.qalaam_in_session` | True while a Hifdh session is active. |
| `select.qalaam_reciter` | Switch the default reciter (writes Options). |
| `select.qalaam_mushaf` | Switch the default mushaf layout. |
| `button.qalaam_test_me` | Fires a `qalaam_hifdh_session_started` event with `trigger=test_me`. |
| `button.qalaam_mark_memorized` | Fires `qalaam_portion_marked_memorized`. |
| `todo.qalaam_hifdh_plan` | TodoListEntity backed by today's Hifdh session. |
| `calendar.qalaam_review_schedule` | FSRS-6 review due dates. |
| Sidebar panel "Qalaam" | Lovelace panel rendering ParentDashboard + StreakCard. |
| Voice intents | `QalaamPlaySurah`, `QalaamPlayAyah`, `QalaamStartHifdh` (English + Arabic sentences for HA Voice Chapter 11 dual-pipeline). |

## Configure

After install, open the integration's options:

- **Target media player** — which speaker should Qalaam route to (Cast, Sonos,
  AirPlay, anything HA can drive).
- **Default reciter slug** — e.g., `mishary-alafasy`, `mahmoud-khalil-husary`,
  `abdul-basit-abd-as-samad`.
- **Qalaam user id** — for multi-tenant Hifdh state lookup. Defaults to
  `demo-user` in v0.1.

## Services

```yaml
service: qalaam.play_ayah
data:
  surah: 2
  ayah: 255
  reciter_slug: mishary-alafasy   # optional; defaults to selected reciter
  target: media_player.living_room
```

```yaml
service: qalaam.play_surah
data:
  surah: 36
  reciter_slug: husary
  target: media_player.kitchen
```

```yaml
service: qalaam.start_memorization_session
data:
  user: demo-user
```

## Events

- `qalaam_ayah_completed` — fired after `play_ayah` resolves on the target.
- `qalaam_hifdh_session_started` — fired by the `test_me` button, the
  `start_memorization_session` service, and the `QalaamStartHifdh` Voice intent.
- `qalaam_portion_marked_memorized` — fired by the `mark_memorized` button.

## Local testing

See `Docs/runbooks/ha-local-testing.md` for the end-to-end dev-stack walkthrough.

## Outcome served

O-09 (smart-home integration), O-13 (ambient passive playback), O-04 (parent
cognitive load — via parent dashboard panel + family-private design).
See `Docs/STRATEGY_AND_ROADMAP.md` §23.2.
