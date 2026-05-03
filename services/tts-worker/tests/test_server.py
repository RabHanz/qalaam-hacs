from __future__ import annotations

from fastapi.testclient import TestClient

from qalaam_tts_worker.server import app


def test_voices_lists_app_voices_and_reserves_recitation() -> None:
    """Per ADR-0019: app-voice slugs are usable; recitation slug is RESERVED."""
    client = TestClient(app)
    res = client.get("/v1/voices")
    assert res.status_code == 200
    voices = res.json()
    slugs = {v["slug"] for v in voices}
    assert "qalaam-app-voice" in slugs
    assert "qalaam-app-voice-warm" in slugs
    # Reserved slug must be advertised so callers know it exists.
    assert "qalaam-house-mujawwad" in slugs
    for v in voices:
        assert v["is_licensed_for_cloning"] is False
        assert v["intended_use"] in ("app-speech", "recitation")


def test_synthesize_app_voice_returns_well_formed_response() -> None:
    client = TestClient(app)
    res = client.post(
        "/v1/synthesize",
        json={"text": "You have three portions due today.", "voice_slug": "qalaam-app-voice"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_ai_generated"] is True
    assert body["watermark"] == "qalaam-v1"
    assert body["voice_slug"] == "qalaam-app-voice"


def test_synthesize_refuses_quranic_text_with_422_and_hint() -> None:
    """Per ADR-0019: ElevenLabs must NEVER render Quranic verses. Refusal
    surfaces as HTTP 422 with a structured hint pointing at /v1/audio/by_verse."""
    client = TestClient(app)
    quranic = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
    res = client.post(
        "/v1/synthesize",
        json={"text": quranic, "voice_slug": "qalaam-app-voice"},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "qalaam.tts.quranic-text-refused"
    assert "/v1/audio/by_verse" in detail["hint"]


def test_synthesize_with_verse_key_is_refused_even_for_plain_text() -> None:
    """Caller-supplied verse_key is the strongest signal — refused unconditionally."""
    client = TestClient(app)
    res = client.post(
        "/v1/synthesize",
        json={
            "text": "Hello world",  # not Quranic shape
            "voice_slug": "qalaam-app-voice",
            "verse_key": "1:1",
        },
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["verse_key"] == "1:1"


def test_synthesize_refuses_reserved_recitation_slug() -> None:
    """qalaam-house-mujawwad MUST NOT route through ElevenLabs."""
    client = TestClient(app)
    res = client.post(
        "/v1/synthesize",
        json={"text": "test", "voice_slug": "qalaam-house-mujawwad"},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "qalaam.tts.quranic-text-refused"
