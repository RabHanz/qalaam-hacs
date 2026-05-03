"""FastAPI entry point for the prosody-worker.

v0.1: deterministic stubs so the API surface is exercisable. v2.0 wires real
numpy/librosa with the TTS fine-tune pipeline.
"""

from __future__ import annotations

import logging
from typing import Final

import structlog
from fastapi import FastAPI, UploadFile
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
_LOG: Final = structlog.get_logger("qalaam.prosody_worker")


class AnalyzeResult(BaseModel):
    sample_rate: int
    duration_ms: int
    f0_mean_hz: float
    f0_contour: list[float]
    energy_envelope: list[float]
    mfcc_means: list[float]


class CompareRequest(BaseModel):
    sample_rate: int = 16000


class CompareResult(BaseModel):
    dtw_distance: float
    pitch_alignment: float
    energy_correlation: float
    overall_score: float


app = FastAPI(
    title="Qalaam Prosody Worker",
    version="0.0.1",
    description=(
        "Python prosody-batch worker. Per ADR-0009: heavy ML in Python, live UI "
        "in TS via @qalaam/prosody. Stateless — no persisted state."
    ),
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.0.1"}


@app.post("/v1/analyze", response_model=AnalyzeResult)
async def analyze(audio: UploadFile) -> AnalyzeResult:  # noqa: ARG001
    """v0.1 stub — real impl in v2.0 wires numpy."""
    return AnalyzeResult(
        sample_rate=16000,
        duration_ms=3000,
        f0_mean_hz=160.0,
        f0_contour=[150.0, 155.0, 162.0, 168.0, 160.0, 152.0],
        energy_envelope=[0.5, 0.6, 0.7, 0.6, 0.5, 0.4],
        mfcc_means=[0.0] * 13,
    )


@app.post("/v1/compare", response_model=CompareResult)
async def compare(
    user: UploadFile,  # noqa: ARG001
    target: UploadFile,  # noqa: ARG001
    request: CompareRequest = CompareRequest(),  # noqa: B008
) -> CompareResult:
    """v0.1 stub — returns a perfect-match result."""
    return CompareResult(
        dtw_distance=0.0,
        pitch_alignment=1.0,
        energy_correlation=1.0,
        overall_score=1.0,
    )
