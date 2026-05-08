"""Nahaj sensor entities — backed by the coordinator's HifdhSnapshot + NowPlayingSnapshot.

Surfaces every observable measurement a household automation needs:

- ``sensor.nahaj_current_verse``            — verse currently playing (text).
- ``sensor.nahaj_streak_days``              — Hifdh streak (TOTAL_INCREASING).
- ``sensor.nahaj_today_session_count``      — portions due today (MEASUREMENT).
- ``sensor.nahaj_grace_days_remaining``     — grace days left (MEASUREMENT).
- ``sensor.nahaj_current_sabqi``            — current sabqi range.
- ``sensor.nahaj_next_prayer``              — next salah ISO (TIMESTAMP).
- ``sensor.nahaj_topic_of_day``             — daily topic.
- ``sensor.nahaj_word_of_day``              — daily Arabic word.
- ``sensor.nahaj_hijri_date``               — formatted Hijri date.
- ``sensor.nahaj_mutashabihat_count``       — similar-ayah pairs in current portion.
- ``sensor.nahaj_active_reciter``           — currently playing reciter slug.
- ``sensor.nahaj_ramadan_phase``            — suhoor / day / iftar / taraweeh
                                               / odd_night / none. Drives the
                                               Ramadan-scenes blueprint.
- ``sensor.nahaj_family_khatm_juz_completed`` — juz completed by the family
                                                 toward the active shared khatm.
                                                 Drives the family-khatm-announce
                                                 blueprint + wall-display tile grid.

Returns ``None`` for fields the backend hasn't populated yet so HA shows
"unknown" instead of a misleading default.
"""

from __future__ import annotations

from datetime import UTC, datetime, time
from typing import Final

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import NahajCoordinator, NahajSnapshot
from .entity import NahajEntity

# Hijri days are 1-indexed; odd days within the last ten nights are
# the candidate Laylat al-Qadr nights (21st/23rd/25th/27th/29th).
_LAYLAT_AL_QADR_PARITY: Final = 1
_TARAWEEH_END_HOUR: Final = 23
_TARAWEEH_END_MIN: Final = 30
_IFTAR_OPEN_HOUR: Final = 17
_SUHOOR_END_HOUR: Final = 6
_NIGHT_PHASE_START_HOUR: Final = 20

_DESCRIPTIONS: Final = (
    SensorEntityDescription(
        key="current_verse",
        translation_key="current_verse",
        icon="mdi:book-open-variant",
    ),
    SensorEntityDescription(
        key="streak_days",
        translation_key="streak_days",
        icon="mdi:fire",
        native_unit_of_measurement="days",
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorEntityDescription(
        key="today_session_count",
        translation_key="today_session_count",
        icon="mdi:format-list-numbered",
        native_unit_of_measurement="portions",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="grace_days_remaining",
        translation_key="grace_days_remaining",
        icon="mdi:calendar-heart",
        native_unit_of_measurement="days",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="current_sabqi",
        translation_key="current_sabqi",
        icon="mdi:bookmark-multiple-outline",
    ),
    SensorEntityDescription(
        key="next_prayer",
        translation_key="next_prayer",
        device_class=SensorDeviceClass.TIMESTAMP,
        icon="mdi:mosque",
    ),
    # Companion to next_prayer (timestamp): the name of that prayer
    # ("fajr" / "dhuhr" / "asr" / "maghrib" / "isha"). Surfaces as a
    # string sensor so Lovelace cards can show "Next: maghrib in 12m"
    # without parsing attributes.
    SensorEntityDescription(
        key="next_prayer_name",
        translation_key="next_prayer_name",
        icon="mdi:mosque-outline",
    ),
    SensorEntityDescription(
        key="topic_of_day",
        translation_key="topic_of_day",
        icon="mdi:tag-text-outline",
    ),
    SensorEntityDescription(
        key="word_of_day",
        translation_key="word_of_day",
        icon="mdi:alphabet-arabic",
    ),
    SensorEntityDescription(
        key="hijri_date",
        translation_key="hijri_date",
        icon="mdi:calendar-month-outline",
    ),
    SensorEntityDescription(
        key="mutashabihat_count",
        translation_key="mutashabihat_count",
        icon="mdi:link-variant",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="active_reciter",
        translation_key="active_reciter",
        icon="mdi:account-music",
    ),
    SensorEntityDescription(
        # Cycles through suhoor → day → iftar → taraweeh → odd_night → none
        # during Ramadan; "none" outside Ramadan. Drives the Ramadan-scenes
        # blueprint. Coarse-grained (one transition per phase, not minute-
        # by-minute) so households can write simple state-trigger automations.
        key="ramadan_phase",
        translation_key="ramadan_phase",
        icon="mdi:moon-waning-crescent",
    ),
    SensorEntityDescription(
        # Number of juz completed by the family toward the active shared
        # khatm (set on the backend; coordinator surfaces aggregate).
        # Drives the family-khatm-announce blueprint + the wall-display
        # khatm tile grid.
        key="family_khatm_juz_completed",
        translation_key="family_khatm_juz_completed",
        icon="mdi:bookshelf",
        native_unit_of_measurement="juz",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    # ─── v0.4 deep-Hifdh sensors ───────────────────────────────────
    # last_rated_at — drives the "did anyone recite today?" automations
    # and the panel's "last activity" stamp. Matches the most-recent
    # mistake/rating timestamp from /v1/mistakes/heatmap pages[0].
    SensorEntityDescription(
        key="last_rated_at",
        translation_key="last_rated_at",
        device_class=SensorDeviceClass.TIMESTAMP,
        icon="mdi:history",
    ),
    # next_review_due — soonest-due unlocked portion. Lets the user
    # write "remind me 30min before fajr if anything is due in 24h"
    # automations.
    SensorEntityDescription(
        key="next_review_due",
        translation_key="next_review_due",
        device_class=SensorDeviceClass.TIMESTAMP,
        icon="mdi:clock-alert-outline",
    ),
    # weakest_page — the single page with the most unresolved mistakes,
    # rendered as "p.42". Drives single-card Lovelace bindings; the
    # array form (mutashabihat_count etc.) is for richer cards.
    SensorEntityDescription(
        key="weakest_page",
        translation_key="weakest_page",
        icon="mdi:book-alert-outline",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: NahajCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([NahajSensor(coordinator, desc) for desc in _DESCRIPTIONS])


class NahajSensor(NahajEntity, SensorEntity):
    def __init__(
        self, coordinator: NahajCoordinator, description: SensorEntityDescription
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{coordinator.entry.entry_id}-sensor-{description.key}"
        self._attr_suggested_object_id = f"nahaj_{description.key}"

    @property
    def native_value(self):  # type: ignore[no-untyped-def]  # noqa: PLR0911 PLR0912 ANN201 — straight-line dispatch over a tagged-union sensor key
        if self.coordinator.data is None:
            return None
        snap = self.coordinator.data
        key = self.entity_description.key
        if key == "current_verse":
            np = snap.now_playing
            return np.verse_key if (np.is_playing and np.verse_key) else None
        if key == "streak_days":
            return snap.hifdh.streak_days
        if key == "today_session_count":
            return snap.hifdh.today_session_count
        if key == "grace_days_remaining":
            return snap.hifdh.grace_days_remaining
        if key == "current_sabqi":
            return snap.hifdh.current_sabqi
        if key == "next_prayer":
            # device_class=TIMESTAMP requires a `datetime` instance with
            # tzinfo, NOT an ISO string — HA's sensor platform validates
            # this and rejects the entity if it gets a str. The coordinator
            # stores the ISO for transport simplicity; we hydrate to datetime
            # here at the entity boundary.
            iso = snap.prayer_window.next_prayer_iso
            if not iso:
                return None
            try:
                return datetime.fromisoformat(iso.replace("Z", "+00:00"))
            except ValueError:
                return None
        if key == "topic_of_day":
            return snap.topic_of_day.name_en or None
        if key == "word_of_day":
            return snap.word_of_day.form_arabic or None
        if key == "hijri_date":
            h = snap.hijri
            if h.year == 0:
                return None
            return f"{h.day:02d} {h.month_english or h.month} {h.year} AH"
        if key == "mutashabihat_count":
            return snap.mutashabihat_count
        if key == "active_reciter":
            return snap.now_playing.reciter_slug
        if key == "ramadan_phase":
            return _compute_ramadan_phase(snap)
        if key == "family_khatm_juz_completed":
            # v0.2: backend route /v1/family/khatm/active surfaces the
            # aggregate. Until the coordinator wires it (post-paid-tier
            # rollout), we surface 0 — automations key off the EVENT
            # `nahaj_family_khatm_milestone` rather than this sensor.
            return 0
        if key == "last_rated_at":
            iso = snap.deep.last_rated_iso
            if not iso:
                return None
            try:
                return datetime.fromisoformat(iso.replace("Z", "+00:00"))
            except ValueError:
                return None
        if key == "next_review_due":
            iso = snap.deep.next_due_iso
            if not iso:
                return None
            try:
                return datetime.fromisoformat(iso.replace("Z", "+00:00"))
            except ValueError:
                return None
        if key == "weakest_page":
            page = snap.deep.weakest_page
            return f"p.{page}" if page is not None else None
        if key == "next_prayer_name":
            return snap.prayer_window.next_prayer_name
        return None

    @property
    def extra_state_attributes(self) -> dict[str, object] | None:  # noqa: PLR0911 — straight-line dispatch over a tagged-union sensor key
        snap = self.coordinator.data
        if snap is None:
            return None
        key = self.entity_description.key
        if key == "current_verse":
            np = snap.now_playing
            return {
                "reciter_slug": np.reciter_slug,
                "position_ms": np.position_ms,
                "speaker_id": np.speaker_id,
            }
        if key == "streak_days":
            return {
                "weakest_pages": list(snap.hifdh.weakest_pages),
                "mutashabihat_watchlist": list(snap.hifdh.mutashabihat_watchlist),
                "manzil_cycle_position": snap.hifdh.manzil_cycle_position,
            }
        if key == "topic_of_day":
            return {
                "slug": snap.topic_of_day.slug,
                "verse_count": snap.topic_of_day.verse_count,
                "sample_verse_key": snap.topic_of_day.sample_verse_key,
            }
        if key == "word_of_day":
            w = snap.word_of_day
            return {
                "verse_key": w.verse_key,
                "lemma": w.lemma,
                "root": w.root,
                "pos": w.pos,
            }
        if key == "hijri_date":
            return {
                "year": snap.hijri.year,
                "month": snap.hijri.month,
                "day": snap.hijri.day,
                "is_ramadan": snap.hijri.is_ramadan,
                "is_last_ten_nights": snap.hijri.is_last_ten_nights,
            }
        if key == "mutashabihat_count":
            return {"watchlist": list(snap.hifdh.mutashabihat_watchlist)}
        if key == "ramadan_phase":
            # Surfaces the deciding inputs so the user can debug a
            # mis-firing scene from the entity card.
            return {
                "is_ramadan": snap.hijri.is_ramadan,
                "is_last_ten_nights": snap.hijri.is_last_ten_nights,
                "next_prayer_name": snap.prayer_window.next_prayer_name,
                "next_prayer_iso": snap.prayer_window.next_prayer_iso,
            }
        return None


def _compute_ramadan_phase(snap: NahajSnapshot) -> str:  # noqa: PLR0911 — straight-line dispatch over a tagged-union phase
    """Map (Hijri + clock + next-prayer) to one of:
    suhoor / day / iftar / taraweeh / odd_night / none.

    Outside Ramadan → "none". During Ramadan, transitions are:
        before Fajr        → suhoor
        Fajr → Maghrib     → day
        Maghrib + 0..30min → iftar
        Isha → +90min      → taraweeh
        odd-night last-10  → overrides taraweeh (Laylat al-Qadr)

    The blueprint subscribes to state-change events and applies the
    matching scene; transition timing is approximated when the
    coordinator hasn't surfaced per-prayer ISO yet.
    """
    if not snap.hijri.is_ramadan:
        return "none"
    np_name = (snap.prayer_window.next_prayer_name or "").lower()
    now_local = datetime.now(UTC).astimezone().time()

    # Last-10-night odd Laylat al-Qadr overrides during evening hours.
    if (
        snap.hijri.is_last_ten_nights
        and snap.hijri.day % 2 == _LAYLAT_AL_QADR_PARITY
        and now_local >= time(_NIGHT_PHASE_START_HOUR, 0)
    ):
        return "odd_night"

    # Coarse phase by next-prayer name + local clock.
    if np_name in {"fajr", "subh"} and now_local < time(_SUHOOR_END_HOUR, 0):
        return "suhoor"
    if np_name == "maghrib":
        return "day"
    # Just after Maghrib (next prayer becomes Isha) — iftar window.
    iftar_open = time(_IFTAR_OPEN_HOUR, 0)
    iftar_close = time(_NIGHT_PHASE_START_HOUR, 30)
    if np_name == "isha" and iftar_open <= now_local <= iftar_close:
        return "iftar"
    # After Isha but before midnight — taraweeh.
    if np_name == "fajr" and time(_NIGHT_PHASE_START_HOUR, 30) <= now_local <= time(
        _TARAWEEH_END_HOUR, _TARAWEEH_END_MIN
    ):
        return "taraweeh"
    return "day"
