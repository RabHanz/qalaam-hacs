"""FastAPI entry point.

Per ADR-0003 + ADR-0009. Exposes Cast + AirPlay over HTTP/JSON. The Node-side
adapter packages call this service.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Final

import structlog
from fastapi import FastAPI, HTTPException

from .models import (
    PlayCommand,
    SeekCommand,
    SimpleCommand,
    SpeakerOut,
    VolumeCommand,
)
from .providers.airplay import AirPlayProvider
from .providers.cast import CastProvider

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
_LOG: Final = structlog.get_logger("qalaam.device_bridge")


cast_provider = CastProvider()
airplay_provider = AirPlayProvider()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await cast_provider.start()
    _LOG.info("device_bridge.startup")
    try:
        yield
    finally:
        await cast_provider.aclose()
        await airplay_provider.aclose()
        _LOG.info("device_bridge.shutdown")


app = FastAPI(
    title="Qalaam Device Bridge",
    version="0.0.1",
    description=(
        "Python sidecar hosting Google Cast (pychromecast) + AirPlay 2 (pyatv). "
        "Per ADR-0003. The Node backend speaks this service over local HTTP/JSON."
    ),
    lifespan=lifespan,
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.0.1"}


@app.get("/v1/cast/discover", response_model=list[SpeakerOut])
async def cast_discover() -> list[SpeakerOut]:
    return [s async for s in cast_provider.discover()]


@app.post("/v1/cast/play")
async def cast_play(cmd: PlayCommand) -> dict[str, str]:
    try:
        await cast_provider.play_url(cmd.device_id, cmd.url)
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(err)) from err
    return {"status": "ok"}


@app.post("/v1/cast/pause")
async def cast_pause(cmd: SimpleCommand) -> dict[str, str]:
    await cast_provider.pause(cmd.device_id)
    return {"status": "ok"}


@app.post("/v1/cast/resume")
async def cast_resume(cmd: SimpleCommand) -> dict[str, str]:
    await cast_provider.resume(cmd.device_id)
    return {"status": "ok"}


@app.post("/v1/cast/seek")
async def cast_seek(cmd: SeekCommand) -> dict[str, str]:
    await cast_provider.seek(cmd.device_id, cmd.position_ms)
    return {"status": "ok"}


@app.post("/v1/cast/volume")
async def cast_volume(cmd: VolumeCommand) -> dict[str, str]:
    await cast_provider.set_volume(cmd.device_id, cmd.level)
    return {"status": "ok"}


@app.post("/v1/cast/announce")
async def cast_announce(cmd: PlayCommand) -> dict[str, str]:
    await cast_provider.announce(cmd.device_id, cmd.url, duck=cmd.duck)
    return {"status": "ok"}


@app.get("/v1/airplay/discover", response_model=list[SpeakerOut])
async def airplay_discover() -> list[SpeakerOut]:
    return [s async for s in airplay_provider.discover()]


@app.post("/v1/airplay/play")
async def airplay_play(cmd: PlayCommand) -> dict[str, str]:
    try:
        await airplay_provider.play_url(cmd.device_id, cmd.url)
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(err)) from err
    return {"status": "ok"}


@app.post("/v1/airplay/pause")
async def airplay_pause(cmd: SimpleCommand) -> dict[str, str]:
    await airplay_provider.pause(cmd.device_id)
    return {"status": "ok"}


@app.post("/v1/airplay/resume")
async def airplay_resume(cmd: SimpleCommand) -> dict[str, str]:
    await airplay_provider.resume(cmd.device_id)
    return {"status": "ok"}


@app.post("/v1/airplay/volume")
async def airplay_volume(cmd: VolumeCommand) -> dict[str, str]:
    await airplay_provider.set_volume(cmd.device_id, cmd.level)
    return {"status": "ok"}
