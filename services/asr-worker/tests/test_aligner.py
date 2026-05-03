from __future__ import annotations

from qalaam_asr_worker.aligner import (
    AlignOp,
    align,
    normalize_arabic,
    tokenize,
    word_error_rate,
)


# Bismillah — fully voweled Uthmani vs unvoweled is a frequent ASR pattern.
BISMILLAH_UTHMANI = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
BISMILLAH_PLAIN = "بسم الله الرحمن الرحيم"


def test_normalize_drops_tashkeel() -> None:
    assert normalize_arabic(BISMILLAH_UTHMANI) == normalize_arabic(BISMILLAH_PLAIN)


def test_normalize_folds_alef_variants() -> None:
    assert normalize_arabic("أمر") == normalize_arabic("امر") == normalize_arabic("إمر")
    assert normalize_arabic("آمن") == normalize_arabic("امن")


def test_normalize_folds_alef_maqsura_to_ya() -> None:
    assert normalize_arabic("على") == normalize_arabic("علي")


def test_normalize_strips_tatweel() -> None:
    assert normalize_arabic("بـسـم") == "بسم"


def test_tokenize_handles_extra_whitespace() -> None:
    toks = tokenize("  بسم   الله  ")
    assert toks == ["بسم", "الله"]


def test_align_perfect_match_emits_all_match_ops() -> None:
    expected = tokenize(BISMILLAH_UTHMANI)
    actual = tokenize(BISMILLAH_PLAIN)
    ops = align(expected, actual)
    assert len(ops) == len(expected)
    for op in ops:
        assert op.op == AlignOp.MATCH


def test_align_detects_substitution() -> None:
    expected = tokenize("بسم الله الرحمن الرحيم")
    # Reciter says "الرحيم الرحيم" instead of "الرحمن الرحيم"
    actual = tokenize("بسم الله الرحيم الرحيم")
    ops = align(expected, actual)
    subs = [o for o in ops if o.op == AlignOp.SUBSTITUTE]
    assert len(subs) == 1
    assert subs[0].expected_word == "الرحمن"
    assert subs[0].actual_word == "الرحيم"


def test_align_detects_deletion_when_word_skipped() -> None:
    expected = tokenize("بسم الله الرحمن الرحيم")
    actual = tokenize("بسم الله الرحيم")  # missing الرحمن
    ops = align(expected, actual)
    dels = [o for o in ops if o.op == AlignOp.DELETE]
    assert len(dels) == 1
    assert dels[0].expected_word == "الرحمن"


def test_align_detects_insertion_when_extra_word_added() -> None:
    expected = tokenize("بسم الله الرحمن الرحيم")
    actual = tokenize("بسم بسم الله الرحمن الرحيم")  # extra leading bism
    ops = align(expected, actual)
    inserts = [o for o in ops if o.op == AlignOp.INSERT]
    assert len(inserts) == 1
    assert inserts[0].expected_word is None


def test_word_error_rate_zero_for_perfect_match() -> None:
    expected = tokenize(BISMILLAH_UTHMANI)
    actual = tokenize(BISMILLAH_PLAIN)
    assert word_error_rate(expected, actual) == 0.0


def test_word_error_rate_positive_for_substitution() -> None:
    expected = tokenize("بسم الله الرحمن الرحيم")
    actual = tokenize("بسم الله الرحيم الرحيم")
    wer = word_error_rate(expected, actual)
    assert 0 < wer <= 1
    # 1 substitution out of 4 expected words → 0.25
    assert abs(wer - 0.25) < 1e-9


def test_word_error_rate_for_empty_expected() -> None:
    assert word_error_rate([], []) == 0.0
    assert word_error_rate([], ["extra"]) == 1.0
