"""FastAPI entry point for the TTS worker."""

from __future__ import annotations

import logging
import os
from typing import Final

import structlog
from fastapi import FastAPI, HTTPException

from .models import SynthesizeRequest, SynthesizeResponse, Voice
from .providers.elevenlabs import ElevenLabsProvider
from .providers.habibi import HabibiProvider

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
_LOG: Final = structlog.get_logger("qalaam.tts_worker")

PROVIDER_NAME: Final = os.environ.get("TTS_PROVIDER", "elevenlabs")

PROVIDERS = {
    "elevenlabs": ElevenLabsProvider(),
    "habibi": HabibiProvider(),
}

if PROVIDER_NAME not in PROVIDERS:
    raise RuntimeError(f"Unknown TTS_PROVIDER {PROVIDER_NAME!r}")

provider = PROVIDERS[PROVIDER_NAME]

app = FastAPI(
    title="Qalaam TTS Worker",
    version="0.0.1",
    description=(
        "TTS provider service. Per ADR-0006 + ADR-0014. v0.1 ships ONLY the "
        "Qalaam-house voice (multi-reciter blend, unattributed) per ADR-0007."
    ),
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {
        "status": "ok",
        "version": "0.0.1",
        "active_provider": PROVIDER_NAME,
    }


@app.get("/v1/voices", response_model=list[Voice])
def list_voices() -> list[Voice]:
    # Per ADR-0007: only Qalaam-house voices through v1.5.
    return [
        Voice(
            slug="qalaam-house",
            name="Qalaam house voice (Murattal)",
            description="Multi-reciter-blend voice trained on a corpus of multiple reciters. Not attributable to any individual.",
            is_licensed_for_cloning=False,
        ),
        Voice(
            slug="qalaam-house-mujawwad",
            name="Qalaam house voice (Mujawwad)",
            description="Same blend with melodic recitation style.",
            is_licensed_for_cloning=False,
        ),
    ]


@app.post("/v1/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    try:
        return await provider.synthesize(req)
    except Exception as err:  # noqa: BLE001
        _LOG.error("tts.synthesize.failed", err=str(err))
        raise HTTPException(status_code=502, detail=str(err)) from err
