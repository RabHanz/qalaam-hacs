# Qalaam Quran (HA integration)

A family-aware, smart-home-aware Quran and Hifdh integration for Home Assistant.

**Status:** v0.1 (alpha). Standalone Qalaam SaaS / self-host install required for full functionality. The integration is a thin shim — see `Docs/STRATEGY_AND_ROADMAP.md` for the full vision.

## Features (v0.1)

- `media_player.qalaam` — single Qalaam player.
- Browseable `media-source://qalaam/` Quran library.
- Service `qalaam.play_ayah` and `qalaam.play_surah` to drive any HA media player.
- `qalaam.start_memorization_session` event-trigger for automation hookup.

## Coming soon (v1.0)

- Sensor, todo, calendar, button entities for Hifdh state.
- HA Voice Chapter 11 dual-pipeline support (Arabic + English).
- Adhan-aware scheduling primitives.
- Family khatm announcements.

## Outcome served

O-09 (smart-home integration), O-13 (ambient passive playback). See `Docs/STRATEGY_AND_ROADMAP.md` §23.2.
