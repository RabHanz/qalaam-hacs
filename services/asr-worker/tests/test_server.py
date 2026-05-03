from __future__ import annotations

from fastapi.testclient import TestClient

from qalaam_asr_worker.server import app


def test_healthz_advertises_privacy_posture() -> None:
    client = TestClient(app)
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["privacy_posture"] == "audio-never-leaves-device"
    assert body["model_id"]
