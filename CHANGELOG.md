# Nahaj HA integration — changelog

## v0.4.2 — 2026-05-08 — Number entity + media transport hardening

### Added

- `number.nahaj_daily_pages_quota` — read/write daily pages quota for
  the user's first active plan. Range 1–20, step 1. Reading polls
  `/v1/plans?status=active` (cached on the entity); writing PATCHes
  `/v1/plans/:id` with `dailyPages: <new>` and triggers a coordinator
  refresh. Surfaces unavailable when no active plan exists — create
  one in the Nahaj web app first. Powered by a new `number` platform
  added to the integration's PLATFORMS list.

- HA panel renders a Daily-quota stat tile (conditional on entity
  availability) so households can see their current quota at a glance
  alongside the deep-Hifdh stats.

### Fixed

- `media_player.nahaj` was missing transport methods that HA cards
  were calling — `media_next_track`, `media_previous_track`,
  `volume_up`, `volume_down`, `mute_volume`. The
  `_attr_supported_features` flags advertised them, but the methods
  themselves weren't implemented, so HA returned "unknown error" on
  every press. All five now forward to the configured target speaker
  through `media_player.<service>` calls, matching the existing
  play / pause / stop / seek pattern.

- `button/press` was returning `'list' object has no attribute 'get'`
  when the backend response was anything other than the expected dict
  envelope (an error page, a Fastify default response, etc.). Both
  `mark_memorized` and `test_me` now isinstance-guard every nested
  `.get()` call so a button press never crashes out of the handler;
  the worst case is a logged warning and a no-op press.

## v0.4.1 — 2026-05-08 — next_prayer_name sensor + panel sync

### Fixed

- v0.4.0 added 3 sensors (last_rated_at, next_review_due, weakest_page)
  and 2 buttons (record_mistake_here, replay_last_portion) but the
  deployed translations/en.json was missing their entries — HA fell
  back to the device-name "Nahaj" for every new entity. Added all
  entries to the actual loaded translations file.

### Added

- `sensor.nahaj_next_prayer_name` — companion to next_prayer
  (timestamp): the prayer name as a string (`fajr` / `dhuhr` / `asr` /
  `maghrib` / `isha`). Lets Lovelace cards show "Next: Maghrib in 12m"
  without parsing the next_prayer entity's attributes.

- HA panel updated **in tandem** with the integration:
  - The Next-prayer stat tile now leads with the prayer NAME (capitalized
    with calm script-style display) and surfaces the time below as the
    sub-label.
  - 3 new conditional stat tiles render only when the deep-Hifdh data
    is present: **Next review** (FSRS-scheduled), **Last rated**, and
    **Weakest page** (gold-accent, since it's the actionable one).
  - New `formatRelativeDay` helper — "today", "in 3d", "yesterday" — so
    the deep-Hifdh tiles read calmly instead of as raw timestamps.
  - Bundle rebuilt + copied to `panel_dist/nahaj-panel.js` so HACS
    installs ship the updated UX with the v0.4.1 release.

## v0.4.0 — 2026-05-08 — Deeper Hifdh signals + interactive recite controls

### Added

- **3 new sensors** for richer Lovelace cards + automation triggers:
  - `sensor.nahaj_last_rated_at` (timestamp) — most recent rating /
    mistake event. Drives "did anyone recite today?" automations.
  - `sensor.nahaj_next_review_due` (timestamp) — soonest-due unlocked
    portion. Lets households schedule reminders 30 min before fajr if
    a portion is overdue.
  - `sensor.nahaj_weakest_page` (string) — the single page with the
    most unresolved mistakes, formatted as `p.42`. One-card binding;
    the array form remains for richer cards.

- **2 new buttons** that route to the live backend:
  - `button.nahaj_record_mistake_here` — POST `/v1/mistakes` with the
    currently-playing verse_key + kind=`hesitation`, source=`self-mark`.
    Used during a recite session; refreshes the heatmap immediately.
  - `button.nahaj_replay_last_portion` — replays the now-playing verse
    on the configured target speaker via `media_player.play_media`.

- Coordinator now fetches `/v1/hifdh/portions` and
  `/v1/mistakes/heatmap` each refresh and surfaces the derived
  signals through a new `HifdhDeepSnapshot` dataclass — anonymous
  installs (no API key) short-circuit so the entities surface as
  unknown rather than fabricating data.

## v0.3.0 — 2026-05-08 — Buttons stop being decorative

### Fixed

- `button.nahaj_test_me` and `button.nahaj_mark_memorized` were
  fire-and-forget HA-bus events that no listener consumed. Both now
  call the live backend through the coordinator's authenticated
  session:
  - **test_me** → fetches today's `/v1/hifdh/session`, fires the
    legacy `nahaj_hifdh_session_started` event with the picked
    verse_key, and (if a target media_player is configured) plays
    that verse on the configured speaker via `media_player.play_media`.
  - **mark_memorized** → POST `/v1/hifdh/rate-current` with a
    Smooth (fluency=3, accuracy=3) rating, fires the legacy
    `nahaj_portion_marked_memorized` event with the resulting
    portion_id and FSRS grade, and triggers a coordinator refresh
    so streak / current-sabqi sensors update without waiting for
    the 5-minute poll.
- Coordinator no longer defaults `user_id` to `"demo-user"` when the
  config-flow user_id is absent. Backend resolves the caller from the
  Bearer header anyway; the legacy default was a footgun that made
  unconfigured installs render the marketing SEED.
- Coordinator drops the `?user_id=` querystring on the GET
  `/v1/hifdh/state` request — it's a no-op since the production-state
  sweep, but removing it kills the spoof-surface entirely.
- `media_source.async_resolve_media` now HEAD-probes the resolved
  audio URL before handing it to the speaker. Confirmed 4xx/5xx
  responses fall back to the everyayah default so a broken upstream
  CDN doesn't manifest as silent speaker failure. Network blips are
  treated as "probably ok" — we only swap on real upstream rejection.

## v0.2.5 — 2026-05-07 — next_prayer datetime coercion

### Fixed

- `sensor.nahaj_next_prayer` was rejected by HA's sensor platform on
  every refresh: `device_class=TIMESTAMP` requires a `datetime`
  instance with tzinfo, but the entity returned the raw ISO string
  from the coordinator snapshot. Sensor stayed "unknown" forever even
  though the coordinator had valid data. Now hydrates the ISO to a
  `datetime` at the entity boundary (transport stays string for
  serialization simplicity; entity converts to datetime when HA reads
  `native_value`).

## v0.2.4 — 2026-05-07 — Brand icon refresh + prayer-window night fix

### Fixed

- `sensor.nahaj_next_prayer` went "unknown" between isha and the
  next morning's fajr because the coordinator only fetched today's
  schedule — once every prayer for today was past, there was no
  "next" to show (4–7h dead window every night). Coordinator now
  fetches today + tomorrow each refresh, and `_build_prayer_window`
  walks today's schedule first then falls through to tomorrow's
  fajr for the night-time window.

### Changed

- Integration card icon now matches the nahaj.app wordmark — Arabic
  "كَلَام" in a metallic gold gradient (Nahaj Gold #b6862c with a
  vertical sheen from #d8a847 → #8a6420) on a soft cream-to-white
  radial background, framed by a hairline gold ring. Calligraphic,
  reverent, modern. Drops the outdated puzzle-piece-style icon.

## v0.2.3 — 2026-05-07 — Live prayer times + local brand icon

### Fixed

- **Prayer time + prayer-window sensors were always "unknown".** The
  coordinator's `prayer_window` field was hardcoded to an empty
  default with a "populated by per-room logic later" comment, so
  `sensor.nahaj_next_prayer` and `binary_sensor.nahaj_in_prayer_window`
  never had data and the panel showed "—". Now wires
  `/v1/prayer-times` against `hass.config.latitude/longitude` (HA's
  general home location) on every coordinator refresh; derives next
  prayer + 30-minute in-window flag from the returned schedule.
  Adhan-aware DND blueprint now actually fires.

- **Integration card icon.** Per the HA 2026.3 Brands Proxy API,
  custom integrations can serve their own icon directly from
  `custom_components/<domain>/brand/`. We were shipping the icon at
  `icons/` (subfolder, ignored by HA) and the integration root
  (also ignored). Moved to `brand/icon.png` (256×256) +
  `brand/icon@2x.png` (512×512). Local files take priority over the
  brands CDN; no upstream PR required for users on HA ≥ 2026.3.

## v0.2.2 — 2026-05-07 — Entity-id collision migration

### Fixed

- v0.2.0 introduced four prayer/Ramadan/Kahf binary sensors and two
  new sensors (Ramadan-phase, family khatm) without a per-key
  `suggested_object_id`, so existing v0.1.x installs ended up with
  collision-suffixed entity IDs (`binary_sensor.nahaj`,
  `binary_sensor.nahaj_2`, …). Blueprints that reference
  `binary_sensor.nahaj_in_prayer_window` etc. couldn't resolve the
  entities. New code: setup-time entity-registry walk that decodes
  the canonical key from each entity's `unique_id` and renames in
  place. Idempotent — re-runs are no-ops.
- All sensor + binary-sensor classes now seed
  `_attr_suggested_object_id = f"nahaj_{key}"` so fresh installs
  also get clean IDs from the start.

## v0.2.1 — 2026-05-07 — Polish + correct API base

### Fixed

- Default API base flipped from `https://api.nahaj.app` (no DNS yet)
  to `https://nahaj.app/api` (the live production
  deployment). Existing users with custom URLs are unaffected; fresh
  installs get the working default.
- Panel default web origin fallback flipped from `nahaj.app` to
  `nahaj.app` so "Open Nahaj →" buttons hit the live
  web app when `panel.config.nahaj.web_url` isn't set yet.
- Documentation URL in `manifest.json` updated to working host.

### Changed

- Panel surfaces six new entities introduced in v0.2.0: Ramadan
  day-shape strip with phase pill (`suhoor` / `iftar` / `taraweeh`
  / `odd_night` / `day`), last-ten-nights ribbon, Friday Sunnah
  window stat, family khatm progress stat, and a prayer-window
  heartbeat strip that shows during salah windows so the household
  knows it's in adab mode.
- Entity translation_keys' friendly names made self-distinctive so
  they don't collide with other integrations' generic-named entities
  in Lovelace card selectors. Examples: "Streak" → "Hifdh streak",
  "Ramadan" → "Ramadan month", "In prayer window" → "Prayer window
  active", "Reciting" → "Quran is playing".
- Icons relocated from `brands/` (HA does not load that path) to
  `icons/` and `icon.png` at the integration root. New `icons.json`
  maps every entity to a sensible MDI default for users who haven't
  customized.

## v0.2.0 — 2026-05-07 — Feature-rich

The big release. Adds eight automation blueprints, four new
binary sensors, two new sensors, a reconfigure flow, brand icons,
and an extended options flow.

### Added

**Sensors:**
- `sensor.nahaj_ramadan_phase` — `suhoor` / `day` / `iftar` /
  `taraweeh` / `odd_night` / `none`. Drives the Ramadan-scenes
  blueprint with one transition per phase.
- `sensor.nahaj_family_khatm_juz_completed` — juz completed by the
  family toward the active shared khatm.

**Binary sensors:**
- `binary_sensor.nahaj_in_prayer_window` — the single most
  automation-relevant flag. Every blueprint that ships gates on
  this so nothing fires during salah.
- `binary_sensor.nahaj_ramadan` — current Hijri month is Ramadan.
- `binary_sensor.nahaj_last_ten_nights` — last ten nights of
  Ramadan, for Laylat al-Qadr awareness.
- `binary_sensor.nahaj_friday_kahf_window` — Thursday Maghrib →
  Friday Maghrib (the Sunnah window for Surah al-Kahf).

**Automation blueprints (`blueprints/automation/nahaj/`):**
- `door-led-wird-status.yaml` — green/amber/red door LED tracks
  today's wird state. Off during prayer windows.
- `adhan-aware-dnd.yaml` — pause TVs, dim lights to a salah scene,
  optionally mute background music, restore previous scene after.
- `sleep-routine.yaml` — last-reviewed portion fades in at low
  volume; bedside light dims to warm amber; gradual fadeout.
- `wake-routine.yaml` — same portion fades in N minutes before Fajr;
  bedside light warms to a sunrise hue. The first sound of the day
  is the Quran.
- `friday-kahf-nudge.yaml` — gentle Sunnah reminder for Surah
  al-Kahf during the Thursday Maghrib → Friday Maghrib window.
- `per-room-sabaq-announce.yaml` — at a scheduled time, the room's
  speaker softly announces "your sabaq starts now" and begins
  playback. Optional focus-scene lighting.
- `ramadan-scenes.yaml` — sahoor warm-dim, iftar welcoming-bright,
  taraweeh prayer-room ambient, gold-accent on odd nights of the
  last ten.
- `family-khatm-announce.yaml` — when any family member completes
  a juz of the shared khatm, the family-room speaker softly
  announces it. Family-private.

**Config flow:**
- New `Reconfigure` step (modern HA pattern). The "..." menu →
  Reconfigure walks the user through the full setup with current
  values pre-filled. Validates new credentials against `/healthz`
  before saving so a typo doesn't strand the user.
- Options flow extended with: family room, child room areas,
  announcement TTS volume, announcement language.

**Brand:**
- `custom_components/nahaj/brands/icon.png` (256×256), `icon@2x.png`
  (512×512), `icon-master.png` (1024×1024). Teal gradient + Naskh
  "قَلَم" wordmark + gold pip — same family as the mobile + web
  brand.

### Changed

- `manifest.json` — version 0.1.0 → 0.2.0.
- `info.md` — full feature catalog refresh.
- `strings.json` — translations for new entities + reconfigure step
  + extended options keys.
- `documentation` URL → `https://nahaj.app/docs/ha`.
- `issue_tracker` URL → `https://github.com/RabHanz/nahaj-hacs/issues`.

### Deprecated / removed

Nothing — this release is purely additive.

---

## v0.1.0 — 2026-04-XX — Initial release

- Sensors: current_verse, streak_days, today_session_count,
  grace_days_remaining, current_sabqi, next_prayer, topic_of_day,
  word_of_day, hijri_date, mutashabihat_count, active_reciter.
- Binary sensors: is_reciting, in_session.
- `media_player.nahaj`, `media-source://nahaj/`,
  `select.nahaj_reciter`, `select.nahaj_mushaf`,
  `button.nahaj_test_me`, `todo.nahaj_hifdh_plan`,
  `calendar.nahaj_review_schedule`.
- Services: play_ayah, play_surah, start_room_sabaq,
  start_memorization_session.
- Voice intents (Arabic + English).
- Lovelace sidebar panel at `/nahaj`.
