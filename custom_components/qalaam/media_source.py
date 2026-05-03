"""Qalaam media-source provider.

URI scheme: ``media-source://qalaam/<reciter-slug>/<surah>[/<ayah>]``

Browse layers:
  ""                           → list reciters (from coordinator catalog)
  "<reciter>"                  → list 114 surahs
  "<reciter>/<surah>"          → list ayahs for that surah (≤ 286)

Resolution:
  "<reciter>/<surah>/<ayah>"   → fetch
                                  ``GET /v1/audio/by_verse/<surah>:<ayah>/<reciter>``
                                  on the configured Qalaam backend, return
                                  ``audioUrl`` (which resolves to everyayah.com
                                  or audio.qurancdn.com).

Per ADR-0003 + strategy §5.
"""

from __future__ import annotations

import logging
from typing import Final

from homeassistant.components.media_player import MediaClass
from homeassistant.components.media_source import (
    BrowseMediaSource,
    MediaSource,
    MediaSourceItem,
    PlayMedia,
    Unresolvable,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    DEFAULT_BASE_URL,
    DEFAULT_RECITER_SLUG,
    DOMAIN,
    MEDIA_SOURCE_NAME,
)
from .coordinator import QalaamCoordinator

_LOGGER: Final = logging.getLogger(__name__)
_PROTOCOL: Final = "audio/mpeg"
# Stand-in surah counts when no QUL data; mushaf canonical for fallback.
_AYAH_COUNTS: Final[tuple[int, ...]] = (
    0,
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6,
)


async def async_get_media_source(hass: HomeAssistant) -> MediaSource:
    return QalaamMediaSource(hass)


class QalaamMediaSource(MediaSource):
    name = MEDIA_SOURCE_NAME

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(DOMAIN)
        self.hass = hass

    def _first_coordinator(self) -> QalaamCoordinator | None:
        bucket = self.hass.data.get(DOMAIN, {})
        for coord in bucket.values():
            if isinstance(coord, QalaamCoordinator):
                return coord
        return None

    async def async_browse_media(self, item: MediaSourceItem) -> BrowseMediaSource:
        identifier = item.identifier or ""
        coord = self._first_coordinator()

        # Top level — list reciters
        if identifier == "":
            reciters = (
                tuple(coord.data.reciters) if coord and coord.data and coord.data.reciters else ()
            )
            children = [
                BrowseMediaSource(
                    domain=DOMAIN,
                    identifier=str(r.get("slug", "")),
                    media_class=MediaClass.DIRECTORY,
                    media_content_type="",
                    title=str(r.get("name", {}).get("en") if isinstance(r.get("name"), dict) else r.get("slug", "")),
                    can_play=False,
                    can_expand=True,
                )
                for r in reciters
            ] or [
                BrowseMediaSource(
                    domain=DOMAIN,
                    identifier=DEFAULT_RECITER_SLUG,
                    media_class=MediaClass.DIRECTORY,
                    media_content_type="",
                    title="Mishary Rashid Alafasy",
                    can_play=False,
                    can_expand=True,
                )
            ]
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier="",
                media_class=MediaClass.DIRECTORY,
                media_content_type="",
                title=MEDIA_SOURCE_NAME,
                can_play=False,
                can_expand=True,
                children=children,
                children_media_class=MediaClass.DIRECTORY,
            )

        parts = identifier.split("/")
        # Reciter level — list 114 surahs
        if len(parts) == 1:
            slug = parts[0]
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier=identifier,
                media_class=MediaClass.DIRECTORY,
                media_content_type="",
                title=slug.replace("-", " ").title(),
                can_play=False,
                can_expand=True,
                children=[
                    BrowseMediaSource(
                        domain=DOMAIN,
                        identifier=f"{slug}/{i}",
                        media_class=MediaClass.DIRECTORY,
                        media_content_type="",
                        title=f"Surah {i}",
                        can_play=False,
                        can_expand=True,
                    )
                    for i in range(1, 115)
                ],
                children_media_class=MediaClass.DIRECTORY,
            )

        # Surah level — list ayahs
        if len(parts) == 2:
            slug, surah_str = parts
            try:
                surah = int(surah_str)
            except ValueError as err:
                raise Unresolvable(f"bad surah id: {surah_str!r}") from err
            if not 1 <= surah <= 114:
                raise Unresolvable(f"surah out of range: {surah}")
            count = _AYAH_COUNTS[surah]
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier=identifier,
                media_class=MediaClass.DIRECTORY,
                media_content_type="",
                title=f"Surah {surah}",
                can_play=False,
                can_expand=True,
                children=[
                    BrowseMediaSource(
                        domain=DOMAIN,
                        identifier=f"{slug}/{surah}/{a}",
                        media_class=MediaClass.MUSIC,
                        media_content_type=_PROTOCOL,
                        title=f"Ayah {a}",
                        can_play=True,
                        can_expand=False,
                    )
                    for a in range(1, count + 1)
                ],
                children_media_class=MediaClass.MUSIC,
            )

        # Ayah level — playable leaf
        return BrowseMediaSource(
            domain=DOMAIN,
            identifier=identifier,
            media_class=MediaClass.MUSIC,
            media_content_type=_PROTOCOL,
            title=identifier,
            can_play=True,
            can_expand=False,
        )

    async def async_resolve_media(self, item: MediaSourceItem) -> PlayMedia:
        ident = item.identifier or ""
        parts = ident.split("/")
        if len(parts) != 3:
            raise Unresolvable(
                f"qalaam media-source identifier must be '<reciter>/<surah>/<ayah>'; got {ident!r}"
            )
        slug, surah_str, ayah_str = parts
        try:
            surah = int(surah_str)
            ayah = int(ayah_str)
        except ValueError as err:
            raise Unresolvable(f"bad surah/ayah ints: {ident!r}") from err

        coord = self._first_coordinator()
        base_url = (
            coord.entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL) if coord else DEFAULT_BASE_URL
        )
        api_key = coord.entry.data.get(CONF_API_KEY, "") if coord else ""

        verse_key = f"{surah}:{ayah}"
        url = f"{base_url.rstrip('/')}/v1/audio/by_verse/{verse_key}/{slug}"
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
                timeout=10,
            ) as resp:
                if resp.status >= 400:
                    raise Unresolvable(f"backend returned {resp.status}")
                payload = await resp.json()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("qalaam.media_source.resolve_failed: %s — falling back to direct everyayah", err)
            # Fallback so the user always hears something even with backend down.
            padded = f"{surah:03d}{ayah:03d}"
            return PlayMedia(
                url=f"https://everyayah.com/data/Alafasy_128kbps/{padded}.mp3",
                mime_type=_PROTOCOL,
            )
        audio_url = payload.get("audioUrl")
        if not isinstance(audio_url, str):
            raise Unresolvable("backend returned no audioUrl")
        return PlayMedia(url=audio_url, mime_type=_PROTOCOL)
