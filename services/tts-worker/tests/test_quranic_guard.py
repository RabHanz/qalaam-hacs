from __future__ import annotations

import pytest

from qalaam_tts_worker.models import SynthesizeRequest
from qalaam_tts_worker.quranic_guard import (
    QuranicTextRefused,
    is_quranic_text,
    refuse_if_quranic,
)


def test_plain_english_passes() -> None:
    assert is_quranic_text("You have 3 portions due today.") == (False, None)


def test_plain_msa_arabic_passes() -> None:
    # Modern MSA prose without tashkeel — what ElevenLabs is for.
    msa = "مرحباً، لديك ثلاثة أجزاء مقررة اليوم."
    assert is_quranic_text(msa)[0] is False


def test_uthmani_bismillah_is_refused() -> None:
    is_q, reason = is_quranic_text("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")
    assert is_q is True
    assert reason is not None


def test_end_of_ayah_glyph_triggers_refusal() -> None:
    is_q, reason = is_quranic_text("الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝")
    assert is_q is True
    assert reason is not None and "U+06DD" in reason


def test_hamzat_al_wasl_alif_triggers_refusal() -> None:
    # ٱ is essentially Quranic-script-only.
    is_q, reason = is_quranic_text("ٱللَّه")
    assert is_q is True
    assert reason is not None and "hamzat al-wasl" in reason.lower()


def test_high_tashkeel_density_triggers_refusal() -> None:
    is_q, reason = is_quranic_text("قُلْ هُوَ اللَّهُ أَحَدٌ")
    assert is_q is True
    assert reason is not None


def test_known_opener_triggers_refusal_even_with_low_tashkeel() -> None:
    is_q, _ = is_quranic_text("الٓمٓ ذلك الكتاب")
    assert is_q is True


def test_refuse_if_quranic_raises_on_verse_key() -> None:
    with pytest.raises(QuranicTextRefused) as exc:
        refuse_if_quranic(
            SynthesizeRequest(text="anything", voice_slug="qalaam-app-voice", verse_key="2:255")
        )
    assert "2:255" in str(exc.value)


def test_refuse_if_quranic_passes_for_plain_text() -> None:
    refuse_if_quranic(
        SynthesizeRequest(
            text="Welcome back. Pick up where you left off.",
            voice_slug="qalaam-app-voice",
        )
    )  # no exception
