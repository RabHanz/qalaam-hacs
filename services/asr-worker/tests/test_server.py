from __future__ import annotations

import json

from fastapi.testclient import TestClient
from qalaam_asr_worker.server import app


def test_healthz_advertises_privacy_posture() -> None:
    client = TestClient(app)
    res = client.get("/healthz")
    assert res.status_code == 200  # noqa: PLR2004 — HTTP 200 is canonical
    body = res.json()
    assert body["status"] == "ok"
    assert body["privacy_posture"] == "audio-never-leaves-device"
    assert body["model_id"]
    assert "ws" in body["transports"]


def test_recite_ws_emits_partial_then_final() -> None:
    """End-to-end WS roundtrip on the stub provider — exercises the full
    init → audio chunks → partial → end → final lifecycle without a model.
    """
    client = TestClient(app)
    expected = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
    with client.websocket_connect("/v1/recite/ws") as ws:
        ws.send_text(
            json.dumps(
                {
                    "type": "init",
                    "expected_verse_key": "1:1",
                    "expected_text_uthmani": expected,
                    "sample_rate": 16000,
                    "audio_format": "webm",
                }
            )
        )
        # Send enough bytes that the stub reveals all 4 expected words.
        ws.send_bytes(b"\x00" * 16000)
        ws.send_text(json.dumps({"type": "end"}))

        # Drain frames until we see the final.
        saw_final = False
        for _ in range(8):
            msg = ws.receive_json()
            assert msg["type"] in {"partial", "final"}
            if msg["type"] == "final":
                saw_final = True
                assert msg["result"]["expected_verse_key"] == "1:1"
                assert len(msg["result"]["word_results"]) == len(expected.split())
                break
        assert saw_final, "WS closed without a final frame"


def test_recite_ws_rejects_audio_before_init() -> None:
    client = TestClient(app)
    with client.websocket_connect("/v1/recite/ws") as ws:
        ws.send_bytes(b"\x00" * 1000)
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["code"] == "not_initialized"
