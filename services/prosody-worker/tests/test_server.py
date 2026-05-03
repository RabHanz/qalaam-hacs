from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient

from qalaam_prosody_worker.server import app


def test_healthz() -> None:
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_analyze_returns_well_formed_features() -> None:
    client = TestClient(app)
    r = client.post(
        "/v1/analyze",
        files={"audio": ("test.wav", BytesIO(b"\x00" * 16000), "audio/wav")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sample_rate"] == 16000
    assert isinstance(body["f0_contour"], list)
    assert len(body["mfcc_means"]) == 13
