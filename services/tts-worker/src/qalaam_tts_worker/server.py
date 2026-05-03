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
from .quranic_guard import QuranicTextRefused

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
    """Per ADR-0007 + ADR-0019: app-voice slugs through v1.5; recitation slug
    reserved (refused by ElevenLabs at synthesize time)."""
    return [
        Voice(
            slug="qalaam-app-voice",
            name="Qalaam app voice",
            description=(
                "General-purpose Arabic + English voice for Qalaam UI/system speech: "
                "settings prompts, deep-study explanations, session cues, daily summary "
                "narration. NOT used for Quranic recitation (those are served from "
                "pre-recorded reciter audio via /v1/audio/by_verse)."
            ),
            is_licensed_for_cloning=False,
            intended_use="app-speech",
        ),
        Voice(
            slug="qalaam-app-voice-warm",
            name="Qalaam app voice (warm)",
            description=(
                "Softer alternate for night-mode / sleep flows. Same scope as "
                "qalaam-app-voice — never used for Quranic verses."
            ),
            is_licensed_for_cloning=False,
            intended_use="app-speech",
        ),
        Voice(
            slug="qalaam-house-mujawwad",
            name="Qalaam house voice (Mujawwad) — RESERVED for v2.5+",
            description=(
                "Reserved for Habibi-TTS-MSA fine-tuned on the Quran corpus per "
                "ADR-0006/0007. Refused by ElevenLabs (no tajweed model). "
                "Will become available once the Habibi backend is wired in v2.5."
            ),
            is_licensed_for_cloning=False,
            intended_use="recitation",
        ),
    ]


@app.post("/v1/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    try:
        return await provider.synthesize(req)
    except QuranicTextRefused as err:
        # 422 (not 502) — the request is well-formed but routed to the wrong
        # provider. Body carries a hint pointing at /v1/audio/by_verse.
        _LOG.warning("tts.synthesize.refused.quranic", err=str(err), verse_key=req.verse_key)
        raise HTTPException(
            status_code=422,
            detail={
                "code": "qalaam.tts.quranic-text-refused",
                "message": str(err),
                "hint": "Route Quranic verses through /v1/audio/by_verse/<verse_key>/<reciter>.",
                "verse_key": req.verse_key,
            },
        ) from err
    except Exception as err:  # noqa: BLE001
        _LOG.error("tts.synthesize.failed", err=str(err))
        raise HTTPException(status_code=502, detail=str(err)) from err
