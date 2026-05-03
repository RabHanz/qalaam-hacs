"""Smoke tests — provider integration tests need real LAN hardware and live in a
separate `make integration-test` profile (CI doesn't run them)."""

from __future__ import annotations

import pytest

from qalaam_device_bridge.models import PlayCommand, SpeakerOut, SpeakerStateOut, VolumeCommand


def test_speaker_serializes_with_required_fields() -> None:
    s = SpeakerOut(
        id="urn:qalaam:speaker:cast:abc",
        adapter="cast",
        external_id="abc",
        name="Living Room",
        capabilities=["play_url", "pause"],
        state=SpeakerStateOut(status="idle"),
    )
    json = s.model_dump_json()
    assert "urn:qalaam:speaker:cast:abc" in json
    assert "Living Room" in json


def test_play_command_validates_minimum() -> None:
    pc = PlayCommand(device_id="abc", url="https://example.test/x.mp3")
    assert pc.announce is False
    assert pc.duck is False


def test_volume_command_clamps_to_unit_range() -> None:
    with pytest.raises(Exception):
        VolumeCommand(device_id="abc", level=2.0)
    with pytest.raises(Exception):
        VolumeCommand(device_id="abc", level=-0.1)
