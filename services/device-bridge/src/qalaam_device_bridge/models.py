"""Pydantic models exchanged with the Node backend.

The shape mirrors `packages/schema/schemas/device/Speaker.schema.json` but
intentionally re-defines the wire types here — the device-bridge runs in a
separate process and we want zero hard dependencies on the codegen artifacts at
import time.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CapabilityName = Literal[
    "play_url", "pause", "resume", "seek", "volume", "queue", "group", "announce", "duck"
]

SpeakerStatus = Literal["idle", "playing", "paused", "buffering", "off", "unavailable"]


class SpeakerStateOut(BaseModel):
    status: SpeakerStatus
    position_ms: int | None = None
    media_id: str | None = None
    volume: float | None = None
    is_muted: bool | None = None


class SpeakerOut(BaseModel):
    id: str = Field(description="Stable urn:qalaam:speaker:<adapter>:<external_id>")
    adapter: Literal["cast", "airplay"]
    external_id: str
    name: str
    room: str | None = None
    capabilities: list[CapabilityName]
    state: SpeakerStateOut


class PlayCommand(BaseModel):
    device_id: str = Field(description="External device id (e.g., Cast UUID)")
    url: str
    media_title: str | None = None
    verse_key: str | None = None
    reciter_slug: str | None = None
    announce: bool = False
    duck: bool = False


class SimpleCommand(BaseModel):
    device_id: str


class SeekCommand(SimpleCommand):
    position_ms: int


class VolumeCommand(SimpleCommand):
    level: float = Field(ge=0.0, le=1.0)
