"""Nahaj media_player entity.

Per ADR-0003: this entity is a *proxy* — it forwards play_media to a configured
target media_player (Cast, Sonos, AirPlay, etc.). Nahaj does not directly drive
any speaker through HA; the target player remains the user's choice.

State is mirrored from the target via async_track_state_change_event so the
Nahaj entity always reflects what's actually playing on the resolved speaker.
"""

from __future__ import annotations

import logging
from typing import Any, Final

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import CONF_TARGET_PLAYER, DOMAIN
from .coordinator import NahajCoordinator
from .entity import NahajEntity

_LOGGER: Final = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: NahajCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([NahajMediaPlayer(coordinator)])


class NahajMediaPlayer(NahajEntity, MediaPlayerEntity):
    """The Nahaj media_player. Routes play_media to a configured target."""

    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.BROWSE_MEDIA
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.MEDIA_ANNOUNCE
        | MediaPlayerEntityFeature.SEEK
        | MediaPlayerEntityFeature.VOLUME_SET
    )

    _attr_media_content_type = MediaType.MUSIC
    _attr_translation_key = "nahaj_player"

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-media_player"
        self._target_entity_id: str | None = coordinator.entry.options.get(CONF_TARGET_PLAYER)
        if self._target_entity_id is None:
            self._target_entity_id = coordinator.entry.data.get(CONF_TARGET_PLAYER)
        self._unsub: list[callable] = []

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        if self._target_entity_id:
            unsub = async_track_state_change_event(
                self.hass,
                [self._target_entity_id],
                self._on_target_state_change,
            )
            self._unsub.append(unsub)

    async def async_will_remove_from_hass(self) -> None:
        for u in self._unsub:
            u()
        self._unsub.clear()
        await super().async_will_remove_from_hass()

    @callback
    def _on_target_state_change(self, _event: Event[EventStateChangedData]) -> None:
        self.async_write_ha_state()

    @property
    def state(self) -> MediaPlayerState | None:
        target = self._target_state()
        if not target:
            return MediaPlayerState.IDLE
        try:
            return MediaPlayerState(target.state)
        except ValueError:
            return MediaPlayerState.IDLE

    @property
    def media_position(self) -> int | None:
        s = self._target_state()
        return s.attributes.get("media_position") if s else None

    @property
    def media_duration(self) -> int | None:
        s = self._target_state()
        return s.attributes.get("media_duration") if s else None

    @property
    def media_title(self) -> str | None:
        s = self._target_state()
        return s.attributes.get("media_title") if s else None

    @property
    def media_artist(self) -> str | None:
        s = self._target_state()
        return s.attributes.get("media_artist") if s else None

    @property
    def volume_level(self) -> float | None:
        s = self._target_state()
        return s.attributes.get("volume_level") if s else None

    def _target_state(self):  # type: ignore[no-untyped-def]
        if not self._target_entity_id:
            return None
        return self.hass.states.get(self._target_entity_id)

    async def async_play_media(
        self,
        media_type: str,
        media_id: str,
        **kwargs: Any,
    ) -> None:
        """Forward to the target media_player.

        If a media-source URI is passed (`media-source://nahaj/...`), HA's
        `media_source.async_resolve_media` resolves it before calling this.
        We just forward the resolved URL to the target.
        """
        if not self._target_entity_id:
            _LOGGER.warning(
                "nahaj: no target_player configured; set one in Options to enable forwarding."
            )
            return
        await self.hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": self._target_entity_id,
                "media_content_id": media_id,
                "media_content_type": media_type or MediaType.MUSIC,
                **{k: v for k, v in kwargs.items() if k in {"announce", "enqueue", "extra"}},
            },
            blocking=True,
        )

    async def async_media_pause(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player", "media_pause", {"entity_id": self._target_entity_id}, blocking=True
        )

    async def async_media_play(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player", "media_play", {"entity_id": self._target_entity_id}, blocking=True
        )

    async def async_media_stop(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player", "media_stop", {"entity_id": self._target_entity_id}, blocking=True
        )

    async def async_media_seek(self, position: float) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "media_seek",
            {"entity_id": self._target_entity_id, "seek_position": position},
            blocking=True,
        )

    async def async_set_volume_level(self, volume: float) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": self._target_entity_id, "volume_level": volume},
            blocking=True,
        )

    async def async_media_next_track(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "media_next_track",
            {"entity_id": self._target_entity_id},
            blocking=True,
        )

    async def async_media_previous_track(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "media_previous_track",
            {"entity_id": self._target_entity_id},
            blocking=True,
        )

    async def async_volume_up(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "volume_up",
            {"entity_id": self._target_entity_id},
            blocking=True,
        )

    async def async_volume_down(self) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "volume_down",
            {"entity_id": self._target_entity_id},
            blocking=True,
        )

    async def async_mute_volume(self, mute: bool) -> None:
        if not self._target_entity_id:
            return
        await self.hass.services.async_call(
            "media_player",
            "volume_mute",
            {"entity_id": self._target_entity_id, "is_volume_muted": mute},
            blocking=True,
        )
