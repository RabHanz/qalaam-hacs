# ruff: noqa: PLR2004 RUF100 BLE001
# HTTP status comparisons (>= 400, == 401/429) and broad-Exception catch
# blocks are idiomatic for HA integration soft-fail patterns; the upstream
# project's ruff config treats these as acceptable.
"""DataUpdateCoordinator for Qalaam.

Per HA best practice: one coordinator per logical data source. The catalog
(reciter list, api_version) refreshes on the slow interval; the Hifdh state
(streak, current sabqi, today's session count) and now-playing state are
fetched on the same poll for v0.1 — v1.0 splits them into a fast-poll
coordinator + WebSocket push for real-time accuracy.

Soft-fail design: a fetch failure on one endpoint doesn't take down the
whole snapshot. The coordinator surfaces stale data with a warning rather
than tanking every entity in the integration. Per CLAUDE.md "build for the
foundation" + ADR-0015 (HTTP/JSON v0.1 → gRPC v1.0).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any, Final

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_USER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_SCAN_INTERVAL_SECONDS,
    DOMAIN,
)

_LOGGER: Final = logging.getLogger(__name__)

_QALAAM_SPEAKER_ID: Final = "qalaam"


@dataclass(slots=True, frozen=True)
class HifdhSnapshot:
    """Per-user Hifdh aggregate — drives the streak / sabqi / session sensors."""

    user_id: str
    streak_days: int = 0
    grace_days_remaining: int = 2
    current_sabqi: str | None = None
    manzil_cycle_position: str | None = None
    weakest_pages: tuple[str, ...] = field(default_factory=tuple)
    mutashabihat_watchlist: tuple[str, ...] = field(default_factory=tuple)
    today_session_count: int = 0


@dataclass(slots=True, frozen=True)
class NowPlayingSnapshot:
    """Backend's view of the qalaam virtual speaker — drives is_reciting + current_verse."""

    speaker_id: str = _QALAAM_SPEAKER_ID
    verse_key: str | None = None
    reciter_slug: str | None = None
    position_ms: int = 0
    is_playing: bool = False


@dataclass(slots=True, frozen=True)
class TopicOfDay:
    """Surfaces a curated topic + a sample verse for the panel + sensor."""

    slug: str = ""
    name_en: str = ""
    verse_count: int = 0
    sample_verse_key: str | None = None


@dataclass(slots=True, frozen=True)
class WordOfDay:
    """Surfaces a Quranic Arabic Corpus word for the daily-vocab sensor."""

    verse_key: str = ""
    form_arabic: str = ""
    lemma: str | None = None
    root: str | None = None
    pos: str = ""


@dataclass(slots=True, frozen=True)
class HijriToday:
    """Hijri date snapshot from /v1/hijri/today (drives sensors + Ramadan flag)."""

    year: int = 0
    month: int = 0
    day: int = 0
    month_english: str | None = None
    is_ramadan: bool = False
    is_last_ten_nights: bool = False


@dataclass(slots=True, frozen=True)
class PrayerWindow:
    """Whether the current moment falls inside a prayer window."""

    in_window: bool = False
    next_prayer_name: str | None = None
    next_prayer_iso: str | None = None


@dataclass(slots=True, frozen=True)
class HifdhDeepSnapshot:
    """Extended Hifdh signals derived from /v1/hifdh/portions +
    /v1/mistakes/heatmap. Drives the v0.4 sensor batch (next-review
    due, last-rated, single weakest page) without re-deriving inside
    every entity's native_value."""

    next_due_iso: str | None = None
    last_rated_iso: str | None = None
    weakest_page: int | None = None


@dataclass(slots=True, frozen=True)
class QalaamSnapshot:
    """Coordinator snapshot — catalog + Hifdh + now-playing + companion."""

    reciters: tuple[dict[str, Any], ...]
    api_version: str
    hifdh: HifdhSnapshot
    now_playing: NowPlayingSnapshot
    topic_of_day: TopicOfDay
    word_of_day: WordOfDay
    hijri: HijriToday
    prayer_window: PrayerWindow
    deep: HifdhDeepSnapshot
    mutashabihat_count: int = 0


class QalaamCoordinator(DataUpdateCoordinator[QalaamSnapshot]):
    """Polls the Qalaam backend for catalog + Hifdh state + now-playing."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL_SECONDS),
            config_entry=entry,
        )
        self.entry = entry
        self.base_url: str = entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL).rstrip("/")
        self.api_key: str = entry.data[CONF_API_KEY]
        # user_id is now informational only — the backend resolves the
        # caller from the API-key Bearer header. Kept on the coordinator
        # so event payloads (button presses, automations) can include
        # a stable identifier. We no longer fall back to "demo-user" by
        # default; if neither config nor options carry an id, sensors
        # render as "unknown" until the user reconfigures, instead of
        # silently showing the marketing-demo SEED.
        self.user_id: str | None = entry.options.get(CONF_USER_ID) or entry.data.get(CONF_USER_ID)
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> QalaamSnapshot:
        catalog = await self._fetch_catalog()
        # Hifdh + now-playing + companion data are all best-effort — a
        # 404/5xx on any one degrades to defaults rather than tanking the
        # whole integration. Per ADR-0015 soft-fail posture.
        hifdh = await self._fetch_hifdh_state(soft=True)
        now_playing = await self._fetch_now_playing(soft=True)
        topic_of_day = await self._fetch_topic_of_day(soft=True)
        word_of_day = await self._fetch_word_of_day(soft=True)
        hijri = await self._fetch_hijri(soft=True)
        prayer_window = await self._fetch_prayer_window(soft=True)
        deep = await self._fetch_deep(soft=True)

        return QalaamSnapshot(
            reciters=catalog["reciters"],
            api_version=catalog["api_version"],
            hifdh=hifdh,
            now_playing=now_playing,
            topic_of_day=topic_of_day,
            word_of_day=word_of_day,
            hijri=hijri,
            prayer_window=prayer_window,
            deep=deep,
            mutashabihat_count=len(hifdh.mutashabihat_watchlist),
        )

    async def _fetch_catalog(self) -> dict[str, Any]:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/reciters",
                headers=self._headers(),
                timeout=10,
            ) as resp:
                if resp.status == 401:
                    raise ConfigEntryAuthFailed("API key rejected by Qalaam backend.")
                if resp.status == 429:
                    raise UpdateFailed("Rate limited by Qalaam backend.")
                resp.raise_for_status()
                payload = await resp.json()
        except ConfigEntryAuthFailed:
            raise
        except Exception as err:
            raise UpdateFailed(f"Catalog refresh failed: {err}") from err
        return {
            "reciters": tuple(payload.get("reciters", ())),
            "api_version": str(payload.get("api_version", "0.0.1")),
        }

    async def _fetch_hifdh_state(self, *, soft: bool) -> HifdhSnapshot:
        # Backend resolves caller identity from the Authorization
        # header — no need to pass `?user_id=`. The legacy query-param
        # was removed as part of the production-state sweep (it was a
        # spoof surface; signed-in users could read another user's
        # state by passing `?user_id=their-id`).
        try:
            async with self._session.get(
                f"{self.base_url}/v1/hifdh/state",
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"hifdh/state {resp.status}")
                p = await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.hifdh_state.soft_fail: %s", err)
                # Empty snapshot — sensors render as "unknown" rather
                # than fabricating numbers. The user_id field is purely
                # informational; we surface whatever the backend told us
                # the caller resolved as (or empty string if we never
                # got that far).
                return HifdhSnapshot(user_id=self.user_id or "")
            raise UpdateFailed(f"Hifdh state failed: {err}") from err
        return HifdhSnapshot(
            user_id=str(p.get("user_id") or self.user_id or ""),
            streak_days=int(p.get("streak_days", 0) or 0),
            grace_days_remaining=int(p.get("grace_days_remaining", 2) or 0),
            current_sabqi=p.get("current_sabqi"),
            manzil_cycle_position=p.get("manzil_cycle_position"),
            weakest_pages=tuple(p.get("weakest_pages") or ()),
            mutashabihat_watchlist=tuple(p.get("mutashabihat_watchlist") or ()),
            today_session_count=int(p.get("today_session_count", 0) or 0),
        )

    async def _fetch_now_playing(self, *, soft: bool) -> NowPlayingSnapshot:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/now-playing/{_QALAAM_SPEAKER_ID}",
                headers=self._headers(),
                timeout=5,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"now-playing {resp.status}")
                p = await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.now_playing.soft_fail: %s", err)
                return NowPlayingSnapshot()
            raise UpdateFailed(f"Now-playing failed: {err}") from err
        return NowPlayingSnapshot(
            speaker_id=str(p.get("speaker_id") or _QALAAM_SPEAKER_ID),
            verse_key=p.get("verse_key"),
            reciter_slug=p.get("reciter_slug"),
            position_ms=int(p.get("position_ms", 0) or 0),
            is_playing=bool(p.get("is_playing")),
        )

    async def _fetch_topic_of_day(self, *, soft: bool) -> TopicOfDay:
        """Pick a topic from /v1/topics — deterministically rotating per day
        so each Qalaam home sees a different "topic of the day" but it
        stays stable within a 24h window."""
        try:
            async with self._session.get(
                f"{self.base_url}/v1/topics",
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"topics {resp.status}")
                body = await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.topic_of_day.soft_fail: %s", err)
                return TopicOfDay()
            raise UpdateFailed(f"Topic-of-day failed: {err}") from err

        # Flatten subtopics across categories.
        flat: list[dict[str, Any]] = [
            t for cat in (body.get("categories") or []) for t in (cat.get("topics") or [])
        ]
        if not flat:
            return TopicOfDay()
        # Day-of-year rotation, modulo topic count, gives a stable pick.
        idx = date.today().toordinal() % len(flat)
        t = flat[idx]
        # Best-effort: fetch the first verse_key for a sample.
        sample = None
        try:
            async with self._session.get(
                f"{self.base_url}/v1/topics/{t['slug']}",
                headers=self._headers(),
                timeout=5,
            ) as resp:
                if resp.status < 400:
                    detail = await resp.json()
                    verses = detail.get("verses") or []
                    if verses:
                        sample = verses[0]
        except Exception as exc:  # noqa: BLE001
            _LOGGER.debug("qalaam.topic_of_day.sample_fetch_failed: %s", exc)
        return TopicOfDay(
            slug=str(t.get("slug", "")),
            name_en=str(t.get("nameEn") or t.get("name_en") or ""),
            verse_count=int(t.get("verseCount") or t.get("verse_count") or 0),
            sample_verse_key=sample,
        )

    async def _fetch_word_of_day(self, *, soft: bool) -> WordOfDay:
        """Pull a Quranic Arabic Corpus word for the daily-vocab sensor.
        Strategy: pick a verse from /v1/topics's sample (or default 1:1)
        and grab its first stem token from /v1/morphology/:vk."""
        verse_key = "1:1"
        try:
            async with self._session.get(
                f"{self.base_url}/v1/morphology/{verse_key}",
                headers=self._headers(),
                timeout=5,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"morphology {resp.status}")
                body = await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.word_of_day.soft_fail: %s", err)
                return WordOfDay()
            raise UpdateFailed(f"Word-of-day failed: {err}") from err
        words = body.get("words") or []
        for w in words:
            for tok in w.get("tokens", []) or []:
                if tok.get("isStem"):
                    return WordOfDay(
                        verse_key=verse_key,
                        form_arabic=str(tok.get("form") or ""),
                        lemma=tok.get("lemma"),
                        root=tok.get("root"),
                        pos=str(tok.get("tag") or ""),
                    )
        return WordOfDay()

    async def _fetch_hijri(self, *, soft: bool) -> HijriToday:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/hijri/today",
                headers=self._headers(),
                timeout=5,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"hijri {resp.status}")
                body = await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.hijri.soft_fail: %s", err)
                return HijriToday()
            raise UpdateFailed(f"Hijri failed: {err}") from err
        h = body.get("hijri") or {}
        return HijriToday(
            year=int(h.get("year", 0) or 0),
            month=int(h.get("month", 0) or 0),
            day=int(h.get("day", 0) or 0),
            month_english=h.get("monthEnglish"),
            is_ramadan=bool(body.get("isRamadan")),
            is_last_ten_nights=bool(body.get("isLastTenNightsOfRamadan")),
        )

    async def _fetch_deep(self, *, soft: bool) -> HifdhDeepSnapshot:  # noqa: PLR0912 -- two soft-fail branches for two endpoints; splitting helpers adds boilerplate without clarity
        """Pull /v1/hifdh/portions and /v1/mistakes/heatmap to derive
        next_due, last_rated, weakest_page. Soft-fail empty so the
        rest of the snapshot still ships when these are unavailable.

        We never POST here — read-only enrichment of what already
        comes back from /v1/hifdh/state. Anonymous installs (no
        api_key) short-circuit immediately because both endpoints
        are auth-required.
        """
        if not self.api_key:
            return HifdhDeepSnapshot()

        next_due_iso: str | None = None
        weakest_page: int | None = None
        try:
            async with self._session.get(
                f"{self.base_url}/v1/hifdh/portions",
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status == 200:
                    payload = await resp.json()
                    portions = payload.get("portions") or []
                    # Pick the soonest-due portion that is not locked.
                    earliest: str | None = None
                    for p in portions:
                        if p.get("status") == "locked":
                            continue
                        due = p.get("due")
                        if not isinstance(due, str):
                            continue
                        if earliest is None or due < earliest:
                            earliest = due
                    next_due_iso = earliest
        except Exception as err:  # noqa: BLE001
            if not soft:
                raise UpdateFailed(f"hifdh/portions: {err}") from err
            _LOGGER.debug("qalaam.deep.portions.soft_fail: %s", err)

        last_rated_iso: str | None = None
        try:
            async with self._session.get(
                f"{self.base_url}/v1/mistakes/heatmap",
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    pages = body.get("pages") or []
                    if isinstance(pages, list) and pages:
                        first = pages[0]
                        if isinstance(first, dict):
                            page_no = first.get("page")
                            if isinstance(page_no, int):
                                weakest_page = page_no
                            iso = first.get("most_recent_ts")
                            if isinstance(iso, str):
                                last_rated_iso = iso
        except Exception as err:  # noqa: BLE001
            if not soft:
                raise UpdateFailed(f"mistakes/heatmap: {err}") from err
            _LOGGER.debug("qalaam.deep.mistakes.soft_fail: %s", err)

        return HifdhDeepSnapshot(
            next_due_iso=next_due_iso,
            last_rated_iso=last_rated_iso,
            weakest_page=weakest_page,
        )

    async def _fetch_prayer_window(self, *, soft: bool) -> PrayerWindow:
        """Fetch today's prayer schedule from /v1/prayer-times using the
        home's lat/lon (which HA already knows from the user's general
        config), then derive the next prayer + whether NOW is inside a
        prayer window.

        ``in_window`` is true from each prayer's adhan time through the
        next prayer's adhan, capped at PRAYER_WINDOW_MINUTES so the
        adhan-aware DND blueprint isn't muting speakers all afternoon
        between Asr and Maghrib. Per the user's configured method
        (defaults to muslim-world-league); asr school + high-lat rule
        fall back to backend defaults.

        Fetches today + tomorrow so that between isha and the next
        fajr (a 4-7h window every night) the sensor still shows the
        next prayer instead of going "unknown".
        """
        lat = self.hass.config.latitude
        lon = self.hass.config.longitude
        if lat is None or lon is None:
            _LOGGER.debug("qalaam.prayer_window.no_location")
            return PrayerWindow()
        today = date.today()  # noqa: DTZ011 — HA's local TZ
        tomorrow = today + timedelta(days=1)
        today_body = await self._fetch_prayer_times_for(lat, lon, today.isoformat(), soft=soft)
        tomorrow_body = await self._fetch_prayer_times_for(
            lat, lon, tomorrow.isoformat(), soft=soft
        )
        return _build_prayer_window(today_body, tomorrow_body)

    async def _fetch_prayer_times_for(
        self, lat: float, lon: float, date_iso: str, *, soft: bool
    ) -> dict[str, Any]:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/prayer-times",
                params={"lat": str(lat), "lon": str(lon), "date": date_iso},
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"prayer-times {resp.status}")
                return await resp.json()
        except Exception as err:
            if soft:
                _LOGGER.debug("qalaam.prayer_window.soft_fail %s: %s", date_iso, err)
                return {}
            raise UpdateFailed(f"Prayer-times failed: {err}") from err

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}


# Adhan window: the period after each adhan when the household is
# considered "in salah" — drives the in_prayer_window binary sensor
# and the adhan-aware DND blueprint. 30min is enough for fard +
# sunnah for any of the five prayers; longer windows would muffle
# media for an unreasonable share of the day.
_PRAYER_WINDOW_MINUTES: Final = 30
_PRAYER_NAMES_ORDERED: Final = ("fajr", "dhuhr", "asr", "maghrib", "isha")


def _build_prayer_window(
    today_body: dict[str, Any], tomorrow_body: dict[str, Any] | None = None
) -> PrayerWindow:
    """Pure helper — turn /v1/prayer-times JSON into a PrayerWindow.
    Factored out so tests can drive it without an aiohttp session.

    Walks today's schedule first; if every prayer is past, falls
    through to tomorrow's fajr so ``next_prayer`` never goes
    "unknown" between isha and the next morning.
    """
    schedule = _parse_schedule(today_body)
    schedule.extend(_parse_schedule(tomorrow_body or {}))
    if not schedule:
        return PrayerWindow()
    now = datetime.now(UTC)
    in_window = False
    next_name: str | None = None
    next_iso: str | None = None
    for name, dt in schedule:
        delta_min = (now - dt).total_seconds() / 60
        if 0 <= delta_min <= _PRAYER_WINDOW_MINUTES:
            in_window = True
        if dt > now and next_iso is None:
            next_name = name
            next_iso = dt.isoformat()
    return PrayerWindow(
        in_window=in_window,
        next_prayer_name=next_name,
        next_prayer_iso=next_iso,
    )


def _parse_schedule(body: dict[str, Any]) -> list[tuple[str, datetime]]:
    times = body.get("times") or {}
    out: list[tuple[str, datetime]] = []
    for name in _PRAYER_NAMES_ORDERED:
        iso = times.get(name)
        if not isinstance(iso, str) or not iso:
            continue
        try:
            # ISO from backend ends in Z — fromisoformat in 3.11+ handles
            # this directly. Coerce to UTC for stable comparison.
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(UTC)
        except ValueError:
            continue
        out.append((name, dt))
    return out
