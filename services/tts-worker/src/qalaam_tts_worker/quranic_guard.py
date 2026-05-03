"""Hard guard against accidentally synthesizing Quranic verses with a
general-purpose TTS provider.

ElevenLabs (and any general MSA TTS) does not know tajweed. It will mispronounce
hamzat al-wasl, miss madd lengths, get qalqalah wrong, and produce a flat MSA
reading that any hifdh student will immediately call wrong. Worse, a synthesized
voice in front of a verse violates the spirit of `سَمَاع` — Quran is heard from
qualified reciters with isnad, not from a model.

Per ADR-0019 ("TTS scope: app-voice only") this guard is enforced at the
provider boundary so a future bug in the orchestration layer can't slip a verse
through. The detector is intentionally conservative — false positives (refusing
non-Quranic Arabic that happens to look Quranic) are *fine*; false negatives
(letting a verse through) are not.

Detection signals (any one is sufficient):
  1. Verse-end glyph U+06DD (ARABIC END OF AYAH).
  2. Tashkeel density above 25% — only Quran/poetry text is fully voweled.
  3. Caller-supplied `verse_key` field (callers MUST set this when they know).
  4. Common opening phrase patterns ("بِسْمِ ٱللَّهِ", "قُلْ هُوَ ٱللَّهُ").
"""

from __future__ import annotations

from typing import Final

from .models import SynthesizeRequest

# Unicode points that strongly indicate Quranic text.
_END_OF_AYAH: Final = "۝"  # ۝
_AYAH_NUMBER_FOLLOWS_RE_HINT: Final = "٠"  # ARABIC-INDIC DIGIT ZERO

_TASHKEEL_RANGE_LO: Final = 0x064B
_TASHKEEL_RANGE_HI: Final = 0x0652  # FATHATAN..SUKUN
_DAGGER_ALEF: Final = "ٰ"
_HAMZA_WASLA_ALEF: Final = "ٱ"  # ٱ — almost exclusively Quranic

# Conservative opening-phrase fingerprints (with tashkeel).
_QURANIC_OPENERS: Final[tuple[str, ...]] = (
    "بِسْمِ ٱللَّه",
    "بِسْمِ اللَّه",
    "قُلْ هُوَ ٱللَّه",
    "قُلْ أَعُوذُ",
    "ٱلْحَمْدُ لِلَّه",
    "الْحَمْدُ لِلَّه",
    "الٓمٓ",
)


class QuranicTextRefused(ValueError):
    """Raised when the TTS provider refuses to synthesize text that looks
    Quranic. The orchestration layer should catch this and route the verse
    through the recitation provider instead (pre-recorded reciter audio
    via /v1/audio/by_verse, or in v2.5+ Habibi-TTS-MSA-Quran).
    """


def is_quranic_text(text: str) -> tuple[bool, str | None]:
    """Returns (is_quranic, reason). `reason` is a human-readable diagnostic
    that the provider includes in the refusal so operators can see why."""
    if not text:
        return False, None

    # Signal 1: explicit verse-end glyph.
    if _END_OF_AYAH in text:
        return True, f"contains end-of-ayah glyph U+06DD ({_END_OF_AYAH})"

    # Signal 2: hamzat al-wasl alif (U+0671) — almost exclusively used in
    # Uthmani Mushaf typography; vanishingly rare in modern MSA prose.
    if _HAMZA_WASLA_ALEF in text:
        return True, "contains hamzat al-wasl alif (U+0671) characteristic of Uthmani script"

    # Signal 3: tashkeel density. We only count if the text has >= 8 chars to
    # avoid spuriously refusing tiny phrases like "بِسْمِ" alone.
    arabic_chars = [c for c in text if 0x0600 <= ord(c) <= 0x06FF]
    if len(arabic_chars) >= 8:
        tashkeel = sum(
            1
            for c in arabic_chars
            if _TASHKEEL_RANGE_LO <= ord(c) <= _TASHKEEL_RANGE_HI or c == _DAGGER_ALEF
        )
        density = tashkeel / len(arabic_chars)
        if density > 0.25:
            return True, f"high tashkeel density ({density:.0%}) typical of Quran/poetry"

    # Signal 4: known opener fingerprints.
    head = text.lstrip()[:48]
    for opener in _QURANIC_OPENERS:
        if head.startswith(opener):
            return True, f"begins with known Quranic opener {opener!r}"

    return False, None


# Voice slugs that are reserved for Quran-trained models — general TTS
# providers refuse them at synthesize time. Keep in lock-step with
# `models.py::VoiceSlug`.
RECITATION_RESERVED_SLUGS: Final[frozenset[str]] = frozenset({
    "qalaam-house-mujawwad",
})


def refuse_if_quranic(req: SynthesizeRequest) -> None:
    """Provider-side gate. Raises `QuranicTextRefused` when the request
    looks Quranic.

    Three paths trigger refusal:
      - The voice_slug is reserved for recitation (Quran-trained models only).
      - The caller supplied `verse_key` (always Quranic by definition).
      - The text content matches `is_quranic_text`.

    The exception carries the verse_key (when known) so orchestration can
    convert it into a `/v1/audio/by_verse/<verse_key>/<reciter>` redirect
    automatically.
    """
    if req.voice_slug in RECITATION_RESERVED_SLUGS:
        raise QuranicTextRefused(
            f"voice_slug {req.voice_slug!r} is reserved for Quran-trained models; "
            f"general-purpose TTS cannot render tajweed-correct recitation. "
            f"See ADR-0019."
        )
    if req.verse_key:
        raise QuranicTextRefused(
            f"refusing to synthesize verse_key={req.verse_key!r}: "
            f"Quranic verses must be served from pre-recorded reciter audio "
            f"(/v1/audio/by_verse), not generated by a general-purpose TTS. "
            f"See ADR-0019."
        )
    is_quran, reason = is_quranic_text(req.text)
    if is_quran:
        raise QuranicTextRefused(
            f"refusing to synthesize text that appears to be Quranic ({reason}). "
            f"Route the verse through /v1/audio/by_verse instead. See ADR-0019."
        )
