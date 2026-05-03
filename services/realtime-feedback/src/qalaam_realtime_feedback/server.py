"""FastAPI WebSocket server for live recitation feedback.

v0.1: stubs the per-frame ASR call (returns deterministic perfect-match results)
so the web client can integrate against the wire protocol immediately. v1.0
forwards frames to the local ASR worker for real transcription.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Final

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
_LOG: Final = structlog.get_logger("qalaam.realtime_feedback")


@dataclass(slots=True)
class Session:
    expected_verse_key: str
    expected_words: list[str]
    matched: set[int]


app = FastAPI(
    title="Qalaam Realtime Feedback",
    version="0.0.1",
    description=(
        "WebSocket service for live recitation feedback during the verse-pause Hifdh drill. "
        "Per ADR-0005: audio NEVER leaves the device; only derived signals flow."
    ),
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.0.1", "privacy_posture": "audio-never-leaves-device"}


@app.websocket("/v1/feedback")
async def feedback(ws: WebSocket) -> None:
    await ws.accept()
    session: Session | None = None
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "code": "qalaam.range.empty", "detail": "Bad frame"})
                continue
            kind = msg.get("type")
            if kind == "session-start":
                expected = str(msg.get("expected_text_uthmani", "")).split()
                session = Session(
                    expected_verse_key=str(msg.get("expected_verse_key", "")),
                    expected_words=expected,
                    matched=set(),
                )
                _LOG.info("session.start", verse_key=session.expected_verse_key, words=len(expected))
                await ws.send_json({"type": "ready", "expected_words": len(expected)})
            elif kind == "audio":
                # v0.1 stub: simulate one word matched per audio frame, in order.
                if not session:
                    await ws.send_json({"type": "error", "detail": "session-start required first"})
                    continue
                next_idx = len(session.matched)
                if next_idx >= len(session.expected_words):
                    continue
                session.matched.add(next_idx)
                await ws.send_json(
                    {
                        "type": "word-result",
                        "word_index": next_idx,
                        "is_match": True,
                        "confidence": 0.9,
                    }
                )
            elif kind == "session-end":
                if not session:
                    await ws.send_json({"type": "error", "detail": "no active session"})
                    continue
                summary = {
                    "expected_verse_key": session.expected_verse_key,
                    "matched_count": len(session.matched),
                    "expected_count": len(session.expected_words),
                }
                _LOG.info("session.end", **summary)
                await ws.send_json({"type": "complete", "summary": summary})
                session = None
            else:
                await ws.send_json({"type": "error", "detail": f"unknown frame type: {kind!r}"})
    except WebSocketDisconnect:
        _LOG.info("client.disconnect")
