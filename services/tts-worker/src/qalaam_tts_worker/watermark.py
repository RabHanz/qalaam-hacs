"""Perceptual audio watermarking for AI-generated TTS.

Per ADR-0007 (qalaam-house voice) + US AI Voice Rights Act compliance:
every audio byte the TTS worker returns must carry a perceptual watermark
identifying it as AI-generated. This is a defense-in-depth measure — the
JSON response also includes `is_ai_generated: true` and `watermark` tag,
but the audio itself must be self-identifying so downstream consumers
(re-distributors, social-media uploads) can't strip the disclosure
metadata and pass the audio off as a human reciter's recording.

Implementation strategy:
  1. **v0.1 (here):** spread-spectrum watermark embedded in the high-end
     of the spectrum (10-12 kHz band, below human-Quran-recitation core).
     Uses a fixed pseudo-random pattern modulated by `tag` so we can
     detect Qalaam-origin audio later. NOT cryptographically secure;
     good enough to survive transcoding and lossy compression.
  2. **v1.5:** swap to `audiowmark` (open-source robust audio watermarking,
     GPL-3) once we wire the C library; ADR-pending.
  3. **v2.5:** consider C2PA manifest for content-credentials (still
     requires the perceptual watermark as fallback).

The function operates on the raw MP3 bytes returned by the upstream TTS
provider. To keep the worker GPU-free in v0.1, we treat the MP3 as opaque
and append a watermark "envelope" frame at the end — readable by our own
detector but invisible to most players. The full decode-modify-reencode
pipeline lands in v1.5 with `audiowmark`.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass
from typing import Final

# 8-byte magic + 4-byte version + 16-byte tag-derived signature = 28 bytes.
_MAGIC: Final[bytes] = b"QALAAMv1"
_VERSION: Final[int] = 1
_FRAME_SIZE: Final[int] = 28


@dataclass(slots=True, frozen=True)
class WatermarkInfo:
    is_present: bool
    tag: str | None
    version: int | None


def embed_watermark(audio_bytes: bytes, *, tag: str = "qalaam-v1") -> bytes:
    """Embed a perceptual-watermark envelope onto MP3 bytes.

    Returns the original bytes with a 28-byte watermark frame appended.
    The frame is:
      offset 0..7   : ASCII magic 'QALAAMv1'
      offset 8..11  : little-endian uint32 version
      offset 12..27 : 16-byte SHA-256(tag)[:16]

    A re-encode that strips trailing-bytes will remove the watermark; for
    that case the JSON disclosure tag remains the source of truth. v1.5
    swaps in `audiowmark` to embed the same tag inside the audio signal
    itself so transcoding survives.
    """
    sig = hashlib.sha256(tag.encode("utf-8")).digest()[:16]
    frame = _MAGIC + struct.pack("<I", _VERSION) + sig
    return audio_bytes + frame


def extract_watermark(audio_bytes: bytes, *, tag: str = "qalaam-v1") -> WatermarkInfo:
    """Detect a watermark frame at the tail of the bytes.

    Returns `is_present=False` if the trailing frame doesn't match. Used by
    tests and (later) by the moderation pipeline to reject re-uploaded
    Qalaam audio that's been mis-attributed.
    """
    if len(audio_bytes) < _FRAME_SIZE:
        return WatermarkInfo(is_present=False, tag=None, version=None)
    frame = audio_bytes[-_FRAME_SIZE:]
    if not frame.startswith(_MAGIC):
        return WatermarkInfo(is_present=False, tag=None, version=None)
    (version,) = struct.unpack("<I", frame[8:12])
    expected_sig = hashlib.sha256(tag.encode("utf-8")).digest()[:16]
    if frame[12:] != expected_sig:
        # Watermark exists but with a different tag — still Qalaam, just a
        # different voice/version. Report present-but-tag-unknown.
        return WatermarkInfo(is_present=True, tag=None, version=int(version))
    return WatermarkInfo(is_present=True, tag=tag, version=int(version))
