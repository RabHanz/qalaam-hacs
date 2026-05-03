from __future__ import annotations

from fastapi.testclient import TestClient

from qalaam_tts_worker.server import app


def test_voices_returns_only_qalaam_house_v01() -> None:
    """Per ADR-0007: v0.1 ships ONLY the Qalaam-house voice; named-reciter clones are gated."""
    client = TestClient(app)
    res = client.get("/v1/voices")
    assert res.status_code == 200
    voices = res.json()
    assert len(voices) >= 1
    for v in voices:
        assert v["slug"].startswith("qalaam-house")
        assert v["is_licensed_for_cloning"] is False


def test_synthesize_stub_returns_well_formed_response() -> None:
    client = TestClient(app)
    res = client.post(
        "/v1/synthesize",
        json={"text": "Bismillah", "voice_slug": "qalaam-house"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_ai_generated"] is True
    assert body["watermark"] == "qalaam-v1"
    assert body["voice_slug"] == "qalaam-house"
