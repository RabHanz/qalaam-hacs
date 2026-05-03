from __future__ import annotations

import json

from fastapi.testclient import TestClient

from qalaam_realtime_feedback.server import app


def test_healthz() -> None:
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["privacy_posture"] == "audio-never-leaves-device"


def test_ws_full_session() -> None:
    client = TestClient(app)
    with client.websocket_connect("/v1/feedback") as ws:
        ws.send_text(
            json.dumps(
                {
                    "type": "session-start",
                    "expected_verse_key": "1:1",
                    "expected_text_uthmani": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
                }
            )
        )
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["expected_words"] == 4

        for _ in range(4):
            ws.send_text(json.dumps({"type": "audio", "sample_rate": 16000, "samples_b64": ""}))
            wr = ws.receive_json()
            assert wr["type"] == "word-result"
            assert wr["is_match"] is True

        ws.send_text(json.dumps({"type": "session-end"}))
        complete = ws.receive_json()
        assert complete["type"] == "complete"
        assert complete["summary"]["matched_count"] == 4
