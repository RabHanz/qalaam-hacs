# Nahaj — Home Assistant integration

A Quran companion that lives in your home — reading, listening, and
helping your family memorize the Quran together, working with the
speakers and devices you already own.

> The integration brings Nahaj's Quran corpus, Hifdh engine,
> family-private dashboards, and adhan-aware automations into Home
> Assistant as first-class citizens — sensors, media-players, voice
> intents, todos, calendars, services, and a sidebar panel.

**Status:** v0.2.0 — feature-rich. Pairs with the Nahaj SaaS
(`nahaj.app`) by default; self-hosted backend + Premium API key
also supported. See `Docs/STRATEGY_AND_ROADMAP.md` for the full
vision.

---

## What it surfaces in HA

### Sensors

- `sensor.nahaj_current_verse` — verse currently playing.
- `sensor.nahaj_streak_days` — Hifdh streak, with grace days as an attribute.
- `sensor.nahaj_today_session_count` — portions due today.
- `sensor.nahaj_grace_days_remaining` — grace days left this month.
- `sensor.nahaj_current_sabqi` — current sabqi range (e.g. "30:1–15").
- `sensor.nahaj_next_prayer` — next-prayer ISO (`device_class: timestamp`).
- `sensor.nahaj_topic_of_day` — today's topic (e.g. "the patient ones").
- `sensor.nahaj_word_of_day` — daily Arabic word + root + occurrences.
- `sensor.nahaj_hijri_date` — Hijri date with `is_ramadan` / `is_last_ten_nights` attrs.
- `sensor.nahaj_mutashabihat_count` — similar-ayah pairs in the current portion.
- `sensor.nahaj_active_reciter` — slug of the currently routed reciter.
- `sensor.nahaj_ramadan_phase` — `suhoor` / `day` / `iftar` / `taraweeh` / `odd_night` / `none`.
- `sensor.nahaj_family_khatm_juz_completed` — juz the family has completed for the active shared khatm.

### Binary sensors

- `binary_sensor.nahaj_is_reciting` — Nahaj audio currently playing.
- `binary_sensor.nahaj_in_session` — Hifdh session is active.
- `binary_sensor.nahaj_in_prayer_window` — current moment is inside a prayer window. **The single most automation-relevant flag.**
- `binary_sensor.nahaj_ramadan` — current Hijri month is Ramadan.
- `binary_sensor.nahaj_last_ten_nights` — last ten nights of Ramadan (Laylat al-Qadr awareness).
- `binary_sensor.nahaj_friday_kahf_window` — Thursday Maghrib through Friday Maghrib (Sunnah window for Surah al-Kahf).

### Media + selectors + actions

- `media_player.nahaj` — single Nahaj player.
- `media-source://nahaj/` — browse the full Quran library (every reciter, every layout).
- `select.nahaj_reciter` — pick reciter from the catalog.
- `select.nahaj_mushaf` — pick mushaf layout (Madani v1/v2/v4, IndoPak, Qatar, Digital Khatt).
- `button.nahaj_test_me` — verse-pause drill trigger.
- `button.nahaj_mark_memorized` — one-tap "I just heard them recite".
- `todo.nahaj_hifdh_plan` — daily portion list as a todo.
- `calendar.nahaj_review_schedule` — FSRS review schedule + Islamic events.

### Services

- `nahaj.play_ayah` — single ayah on chosen target.
- `nahaj.play_surah` — full surah on chosen target.
- `nahaj.play_current_sabqi` — play the user's current sabqi portion.
- `nahaj.start_room_sabaq` — sabaq announcement + playback in a chosen area.
- `nahaj.start_memorization_session` — fires `nahaj_hifdh_session_started`.

### Voice intents (HA Voice 2024.6+, dual-pipeline)

Arabic (`shaghil surat al-mulk`, `iqra' al-fatiha`, `iqra' ayat al-kursi`)
and English (`play surah Mulk`, `read Al-Fatiha`, `play Ayat al-Kursi`)
both work in the same room — assign Nahaj to the second voice pipeline
slot HA Chapter 11 introduced.

### Sidebar panel

A Lovelace panel mounted at `/nahaj` shows the editorial Hifdh dashboard
inside HA — same family-private framing as the standalone web app, with
live entity state, word-of-the-day, topic-of-the-day, currently-active
recitation, prayer-window heartbeat, and quick actions.

---

## Automation blueprints

Eight blueprints ship in `blueprints/automation/nahaj/` — install via
HA's blueprint UI in two clicks, then customize entities. Each is
**adab-respectful** (no notification spam, no surveillance, no
real-time mistake alerts) and **gates on the prayer-window sensor**
so nothing ever fires during salah.

| Blueprint                      | What it does                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `door-led-wird-status.yaml`    | LED on the bedroom door turns green / amber / red based on today's wird state. Extinguishes during prayer windows.                                 |
| `adhan-aware-dnd.yaml`         | Pauses TVs, dims lights to a salah scene, optionally mutes background music when adhan begins. Restores the previous scene afterwards.             |
| `sleep-routine.yaml`           | Last-reviewed Hifdh portion fades in at low volume; bedside light dims to warm amber; speaker fades to silence after a sleep timer.                |
| `wake-routine.yaml`            | The same portion fades in N minutes before Fajr; bedside light warms to a sunrise hue. The first sound of the day is the Quran.                    |
| `friday-kahf-nudge.yaml`       | Gentle Sunnah reminder for Surah al-Kahf during the Thursday Maghrib → Friday Maghrib window. Notify-only, auto-play, or both.                     |
| `per-room-sabaq-announce.yaml` | At a scheduled time, the kid's-room speaker softly announces "your sabaq starts now" and begins playback. Optional focus-scene lighting.           |
| `ramadan-scenes.yaml`          | Sahoor warm-dim, iftar welcoming-bright, taraweeh prayer-room ambient, gold-accent scene on odd nights of the last ten (Laylat al-Qadr awareness). |
| `family-khatm-announce.yaml`   | When any family member completes a juz of a shared khatm, the family-room speaker softly announces it. Family-private.                             |

---

## Setup

1. Install via HACS (this repo's public mirror at `RabHanz/nahaj-hacs`)
   or copy `custom_components/nahaj/` into your HA `config/`.
2. Restart HA.
3. **Settings → Devices & Services → Add Integration → Nahaj**.
4. Paste your Nahaj Premium API key (generated at
   `nahaj.app/settings/api-keys`).
5. Optional: pick a default media player + reciter in **Configure**.

### Reconfigure (rotate API key, switch to self-hosted, change web origin)

The "..." menu on the integration card → **Reconfigure** opens the
full setup walk-through with current values pre-filled. The new
credentials are validated against the Nahaj health endpoint before
saving so a typo doesn't strand you.

### Options

The "..." menu → **Configure** exposes runtime tunables:

- Default media player + reciter slug
- Family-room area id (used by per-room sabaq blueprint)
- Child-room area ids (used by door-LED automations)
- Family-announcement TTS volume + language

---

## Adab non-negotiables (built into the architecture, not a policy)

- **Audio never leaves the device.** Recitation feedback runs on
  HA's local Whisper / Tarteel ONNX worker. ADR-0005 enforces this at
  the data-model level — the server cannot receive audio even if a
  buggy client tried to send it.
- **Family-private only.** No public leaderboards, no cross-family
  comparison, no global ranking. The blueprints' announcements stay
  inside the household.
- **No surveillance.** Parent dashboard is a daily summary, never a
  real-time mistake feed.
- **No XP / coins / mascots.** Streaks have grace days. Never gamified.
- **Never inside a prayer window.** All blueprints gate on
  `binary_sensor.nahaj_in_prayer_window`. Hifdh sessions don't trigger,
  notifications hush, TVs can dim or pause for the duration.

---

## Outcomes served (per Docs/JTBD)

O-09 (smart-home integration), O-13 (ambient passive playback),
O-04 (parent cognitive load), O-05 (mutashabihat awareness),
O-12 (adhan-aware household routines).

See `Docs/STRATEGY_AND_ROADMAP.md` §10 + §23.2 for the full
specification.
