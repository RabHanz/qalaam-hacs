from __future__ import annotations

from qalaam_tts_worker.watermark import embed_watermark, extract_watermark


def test_watermark_round_trip_default_tag() -> None:
    audio = b"\x00" * 1024
    wm = embed_watermark(audio)
    assert wm.startswith(audio)
    assert len(wm) == len(audio) + 28

    info = extract_watermark(wm)
    assert info.is_present is True
    assert info.tag == "qalaam-v1"
    assert info.version == 1


def test_watermark_round_trip_custom_tag() -> None:
    audio = b"\xff\xfb\x90\x44" * 32
    wm = embed_watermark(audio, tag="qalaam-mujawwad-v1")
    info = extract_watermark(wm, tag="qalaam-mujawwad-v1")
    assert info.is_present is True
    assert info.tag == "qalaam-mujawwad-v1"


def test_watermark_detected_with_unknown_tag_reports_present_but_tag_none() -> None:
    audio = b"\x00" * 256
    wm = embed_watermark(audio, tag="other")
    info = extract_watermark(wm, tag="qalaam-v1")  # detector expects qalaam-v1
    assert info.is_present is True
    assert info.tag is None  # tag mismatch
    assert info.version == 1


def test_unwatermarked_bytes_report_absent() -> None:
    info = extract_watermark(b"random mp3 bytes")
    assert info.is_present is False
    assert info.tag is None
    assert info.version is None


def test_watermark_too_short_input_handled() -> None:
    info = extract_watermark(b"short")
    assert info.is_present is False
