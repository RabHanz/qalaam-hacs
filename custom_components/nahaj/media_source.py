"""Nahaj media-source provider.

Two top-level categories — picked from the root browser:
  recite/   audio recitation (reciter → surah → ayah)
  mushaf/   page-faithful mushaf images (layout → page 1..604)

URI schemes:
  ``media-source://nahaj/recite/<reciter-slug>/<surah>[/<ayah>]``
  ``media-source://nahaj/mushaf/<layout-slug>/<page>``

  For backwards-compat, identifiers without the ``recite/`` or
  ``mushaf/`` prefix are treated as reciter audio (legacy form was
  ``<reciter>/<surah>/<ayah>``).

Browse layers (recite):
  ""                                   → top-level: 'recite' + 'mushaf'
  "recite"                             → list reciters (from coordinator catalog)
  "recite/<reciter>"                   → list 114 surahs
  "recite/<reciter>/<surah>"           → list ayahs for that surah (≤ 286)

Browse layers (mushaf images):
  "mushaf"                             → list layouts (madinah / tajweed / indopak / kfgqpc_v1)
  "mushaf/<layout>"                    → list pages 1..604

Resolution:
  "recite/<reciter>/<surah>/<ayah>"   → ``GET /v1/audio/by_verse/<v>/<r>``
                                          → audioUrl (everyayah / audio.qurancdn).
  "mushaf/<layout>/<page>"             → ``GET /v1/image-mushaf/<layout>/<page>``
                                          → image URL. The HA media browser
                                          renders this on Cast displays and
                                          photo frames; on speaker-only players
                                          it falls back gracefully (HA filters
                                          by supported_features).

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
from .coordinator import NahajCoordinator

_LOGGER: Final = logging.getLogger(__name__)
_PROTOCOL: Final = "audio/mpeg"
_IMAGE_PROTOCOL: Final = "image/png"
# Quran constants — used for browse-tree depth + surah-id validation.
# Named to keep ruff PLR2004 (magic-number-in-comparison) quiet without
# inline noqas.
_NUM_SURAHS: Final = 114
_NUM_PAGES_MADINAH: Final = 604
_BROWSE_DEPTH_SURAH: Final = 2  # parts[0]/parts[1]   = reciter/surah
_BROWSE_DEPTH_AYAH: Final = 3  # parts[0]/.../parts[2] = reciter/surah/ayah

# Image-mushaf layouts. Keys are the URL slugs the backend understands;
# values are the human-readable titles HA shows in the media browser.
_IMAGE_LAYOUTS: Final = {
    "madani-16": "Madinah Mushaf · 16 lines (image)",
}


def _reciter_title(r: dict) -> str:
    """Title fallback for a reciter row from the catalog payload.

    `name` is either a {en, ar} dict or a flat string in legacy payloads;
    fall back to the slug as a last resort. Inlined-conditional was
    flagged for line-length and unwieldy nested isinstance checks; this
    extraction is clearer + ruff-clean.
    """
    name = r.get("name")
    if isinstance(name, dict):
        en = name.get("en")
        if isinstance(en, str) and en:
            return en
    if isinstance(name, str) and name:
        return name
    slug = r.get("slug", "")
    return str(slug) if slug else "Unknown reciter"


# Stand-in surah counts when no QUL data; mushaf canonical for fallback.
_AYAH_COUNTS: Final[tuple[int, ...]] = (
    0,
    7,
    286,
    200,
    176,
    120,
    165,
    206,
    75,
    129,
    109,
    123,
    111,
    43,
    52,
    99,
    128,
    111,
    110,
    98,
    135,
    112,
    78,
    118,
    64,
    77,
    227,
    93,
    88,
    69,
    60,
    34,
    30,
    73,
    54,
    45,
    83,
    182,
    88,
    75,
    85,
    54,
    53,
    89,
    59,
    37,
    35,
    38,
    29,
    18,
    45,
    60,
    49,
    62,
    55,
    78,
    96,
    29,
    22,
    24,
    13,
    14,
    11,
    11,
    18,
    12,
    12,
    30,
    52,
    52,
    44,
    28,
    28,
    20,
    56,
    40,
    31,
    50,
    40,
    46,
    42,
    29,
    19,
    36,
    25,
    22,
    17,
    19,
    26,
    30,
    20,
    15,
    21,
    11,
    8,
    8,
    19,
    5,
    8,
    8,
    11,
    11,
    8,
    3,
    9,
    5,
    4,
    7,
    3,
    6,
    3,
    5,
    4,
    5,
    6,
)


async def async_get_media_source(hass: HomeAssistant) -> MediaSource:
    return NahajMediaSource(hass)


async def _head_ok(session: object, url: str) -> bool:
    """HEAD probe an audio URL — used by resolve_media to fail fast
    when the upstream CDN returns 404 instead of forwarding a broken
    URL to the speaker. Returns False only on confirmed 4xx/5xx; any
    network error is treated as "probably ok" because aiohttp blips
    shouldn't penalise an URL that may actually work."""
    try:
        async with session.head(url, timeout=4, allow_redirects=True) as r:
            return r.status < 400  # noqa: PLR2004 -- HTTP error threshold
    except Exception:
        return True


class NahajMediaSource(MediaSource):
    name = MEDIA_SOURCE_NAME

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(DOMAIN)
        self.hass = hass

    def _first_coordinator(self) -> NahajCoordinator | None:
        bucket = self.hass.data.get(DOMAIN, {})
        for coord in bucket.values():
            if isinstance(coord, NahajCoordinator):
                return coord
        return None

    async def async_browse_media(  # noqa: PLR0911 -- branched browse tree
        self, item: MediaSourceItem
    ) -> BrowseMediaSource:
        identifier = item.identifier or ""
        coord = self._first_coordinator()

        # Backwards-compat: identifiers that DON'T start with "recite/" or
        # "mushaf/" are legacy reciter audio paths (<reciter>/<surah>/<ayah>).
        # Resolve those through the existing recite branch by prepending.
        if identifier and not (
            identifier.startswith("recite/")
            or identifier.startswith("mushaf/")
            or identifier in {"recite", "mushaf"}
        ):
            identifier = f"recite/{identifier}"

        # Top level — split into recite + mushaf-image categories.
        if identifier == "":
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier="",
                media_class=MediaClass.DIRECTORY,
                media_content_type="",
                title=MEDIA_SOURCE_NAME,
                can_play=False,
                can_expand=True,
                children=[
                    BrowseMediaSource(
                        domain=DOMAIN,
                        identifier="recite",
                        media_class=MediaClass.DIRECTORY,
                        media_content_type="",
                        title="Recitation",
                        can_play=False,
                        can_expand=True,
                    ),
                    BrowseMediaSource(
                        domain=DOMAIN,
                        identifier="mushaf",
                        media_class=MediaClass.DIRECTORY,
                        media_content_type="",
                        title="Mushaf images",
                        can_play=False,
                        can_expand=True,
                    ),
                ],
                children_media_class=MediaClass.DIRECTORY,
            )

        # ─── Mushaf-image branch ─────────────────────────────────────
        if identifier == "mushaf":
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier="mushaf",
                media_class=MediaClass.DIRECTORY,
                media_content_type="",
                title="Mushaf images",
                can_play=False,
                can_expand=True,
                children=[
                    BrowseMediaSource(
                        domain=DOMAIN,
                        identifier=f"mushaf/{slug}",
                        media_class=MediaClass.DIRECTORY,
                        media_content_type="",
                        title=title,
                        can_play=False,
                        can_expand=True,
                    )
                    for slug, title in _IMAGE_LAYOUTS.items()
                ],
                children_media_class=MediaClass.DIRECTORY,
            )

        if identifier.startswith("mushaf/"):
            mparts = identifier.split("/")
            # mushaf/<layout> — list pages 1..604
            if len(mparts) == _BROWSE_DEPTH_SURAH:
                _, layout = mparts
                if layout not in _IMAGE_LAYOUTS:
                    raise Unresolvable(f"unknown mushaf layout: {layout!r}")
                return BrowseMediaSource(
                    domain=DOMAIN,
                    identifier=identifier,
                    media_class=MediaClass.DIRECTORY,
                    media_content_type="",
                    title=_IMAGE_LAYOUTS[layout],
                    can_play=False,
                    can_expand=True,
                    children=[
                        BrowseMediaSource(
                            domain=DOMAIN,
                            identifier=f"mushaf/{layout}/{p}",
                            media_class=MediaClass.IMAGE,
                            media_content_type=_IMAGE_PROTOCOL,
                            title=f"Page {p}",
                            can_play=True,
                            can_expand=False,
                        )
                        for p in range(1, _NUM_PAGES_MADINAH + 1)
                    ],
                    children_media_class=MediaClass.IMAGE,
                )
            # mushaf/<layout>/<page> — playable image leaf
            return BrowseMediaSource(
                domain=DOMAIN,
                identifier=identifier,
                media_class=MediaClass.IMAGE,
                media_content_type=_IMAGE_PROTOCOL,
                title=identifier,
                can_play=True,
                can_expand=False,
            )

        # Strip the "recite/" prefix for the existing audio-tree logic;
        # the old code below treats the identifier as <reciter>/<surah>/<ayah>.
        if identifier.startswith("recite/"):
            identifier = identifier[len("recite/") :]

        # "recite" alone — fall through to the reciter list (was '' before).
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
                    title=_reciter_title(r),
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
                    for i in range(1, _NUM_SURAHS + 1)
                ],
                children_media_class=MediaClass.DIRECTORY,
            )

        # Surah level — list ayahs
        if len(parts) == _BROWSE_DEPTH_SURAH:
            slug, surah_str = parts
            try:
                surah = int(surah_str)
            except ValueError as err:
                raise Unresolvable(f"bad surah id: {surah_str!r}") from err
            if not 1 <= surah <= _NUM_SURAHS:
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

        # ─── Mushaf-image branch ──────────────────────────────────
        if ident.startswith("mushaf/"):
            mparts = ident.split("/")
            if len(mparts) != _BROWSE_DEPTH_AYAH:
                raise Unresolvable(
                    f"mushaf identifier must be 'mushaf/<layout>/<page>'; got {ident!r}"
                )
            _, layout, page_str = mparts
            if layout not in _IMAGE_LAYOUTS:
                raise Unresolvable(f"unknown mushaf layout: {layout!r}")
            try:
                page = int(page_str)
            except ValueError as err:
                raise Unresolvable(f"bad page int: {ident!r}") from err
            if not 1 <= page <= _NUM_PAGES_MADINAH:
                raise Unresolvable(f"page out of range: {page}")
            coord = self._first_coordinator()
            # The image-mushaf imageUrl is web-app-relative ("/mushaf-images/..."),
            # so we resolve it against PUBLIC_APP_URL (not the backend API URL).
            # Coordinator stores both — fall back to BASE_URL if app URL absent.
            base = (
                coord.entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL) if coord else DEFAULT_BASE_URL
            )
            app_url = (coord.entry.data.get("public_app_url", "") if coord else "") or base
            url = f"{app_url.rstrip('/')}/mushaf-images/{layout}/{page}.png"
            return PlayMedia(url=url, mime_type=_IMAGE_PROTOCOL)

        # ─── Recite branch (legacy + recite/-prefixed) ────────────
        if ident.startswith("recite/"):
            ident = ident[len("recite/") :]
        parts = ident.split("/")
        if len(parts) != _BROWSE_DEPTH_AYAH:
            raise Unresolvable(
                f"nahaj media-source identifier must be '<reciter>/<surah>/<ayah>'; got {ident!r}"
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
                if resp.status >= 400:  # noqa: PLR2004 -- HTTP error threshold
                    raise Unresolvable(f"backend returned {resp.status}")
                payload = await resp.json()
        except Exception as err:
            _LOGGER.warning(
                "nahaj.media_source.resolve_failed: %s — falling back to direct everyayah", err
            )
            # Fallback so the user always hears something even with backend down.
            padded = f"{surah:03d}{ayah:03d}"
            return PlayMedia(
                url=f"https://everyayah.com/data/Alafasy_128kbps/{padded}.mp3",
                mime_type=_PROTOCOL,
            )
        audio_url = payload.get("audioUrl")
        if not isinstance(audio_url, str):
            raise Unresolvable("backend returned no audioUrl")
        # Validate the resolved URL with a HEAD before handing it to
        # the speaker. Without this, a broken upstream (everyayah outage,
        # CDN 403 on a specific reciter, stale audioUrl in the cache)
        # would surface as the speaker silently failing — no error in
        # HA, just no sound. HEAD is cheap; we only fall back on real
        # 4xx/5xx, not on network blips (those raise).
        if not await _head_ok(session, audio_url):
            _LOGGER.warning(
                "nahaj.media_source.audio_url_404: %s — falling back to everyayah", audio_url
            )
            padded = f"{surah:03d}{ayah:03d}"
            return PlayMedia(
                url=f"https://everyayah.com/data/Alafasy_128kbps/{padded}.mp3",
                mime_type=_PROTOCOL,
            )
        return PlayMedia(url=audio_url, mime_type=_PROTOCOL)
