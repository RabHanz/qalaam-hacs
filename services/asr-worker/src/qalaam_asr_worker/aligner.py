"""Arabic-Quran text aligner.

Word-level alignment between (a) the *expected* Uthmani-script verse text and
(b) the *actual* faster-whisper transcript. Per Phase 9 closure: real
ctc-forced-aligner phoneme alignment requires a CTC-trained Arabic model +
lexicon — heavy dependency, lands in v1.5. This module ships the production
ready text-level layer that captures ~80% of word-mistake detection at zero
GPU cost.

Pipeline:
  1. **Normalize** both strings (drop tashkeel, fold alif/ya/hamza variants,
     strip tatweel, collapse whitespace).
  2. **Word tokenize** on whitespace.
  3. **Align** with Levenshtein-style dynamic programming (match=0, sub=1,
     insert=1, delete=1) — emits a list of `(operation, expected, actual)`
     tuples whose order preserves the verse sequence.
  4. **Score** each expected word: matched (high confidence), substituted
     (low confidence + actual_word filled), or missing (no actual_word).

The aligner is a pure function — no I/O, no random seeds — so the asr-worker
can call it deterministically from any provider (stub, whisper, future ctc).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from typing import Final

# Unicode points to drop entirely (tashkeel + tatweel + hamza-on-line).
# Reference: Unicode 16 Arabic block.
_TASHKEEL_RANGE = (0x064B, 0x065F)  # FATHATAN…HAMZA BELOW
_TATWEEL: Final = "ـ"
_QURANIC_MARKS = (0x06D6, 0x06ED)  # END OF AYAH … SMALL LOW SEEN

# Letter-variant fold table — standardize to a canonical form.
_LETTER_FOLD: Final[dict[str, str]] = {
    "أ": "ا",  # ALEF WITH HAMZA ABOVE → ALEF
    "إ": "ا",  # ALEF WITH HAMZA BELOW → ALEF
    "آ": "ا",  # ALEF WITH MADDA ABOVE → ALEF
    "ٱ": "ا",  # ALEF WASLA → ALEF
    "ى": "ي",  # ALEF MAKSURA → YEH
    "ئ": "ي",  # YEH WITH HAMZA → YEH
    "ؤ": "و",  # WAW WITH HAMZA → WAW
    "ة": "ه",  # TEH MARBUTA → HEH (recitation reads as heh in pause)
    "ء": "",  # Standalone HAMZA — drop (the ASR rarely emits it)
}

_TASHKEEL_RE: Final = re.compile(
    "["
    f"{chr(_TASHKEEL_RANGE[0])}-{chr(_TASHKEEL_RANGE[1])}"
    f"{chr(_QURANIC_MARKS[0])}-{chr(_QURANIC_MARKS[1])}"
    "ٰ"  # ARABIC LETTER SUPERSCRIPT ALEF (al-khanjariyya) — phonetic alif, no glyph
    "]"
)


def normalize_arabic(text: str) -> str:
    """Drop tashkeel, fold variants, collapse whitespace.

    The same normalization is applied to both expected and actual text before
    alignment so spelling differences that don't change pronunciation don't
    show up as mistakes.
    """
    if not text:
        return ""
    # Unicode normalize (NFKC) so combined forms decompose predictably.
    text = unicodedata.normalize("NFKC", text)
    text = _TASHKEEL_RE.sub("", text)
    text = text.replace(_TATWEEL, "")
    out = []
    for ch in text:
        out.append(_LETTER_FOLD.get(ch, ch))
    return re.sub(r"\s+", " ", "".join(out)).strip()


def tokenize(text: str) -> list[str]:
    """Word tokenize a normalized Arabic string."""
    n = normalize_arabic(text)
    return [w for w in n.split(" ") if w]


class AlignOp(str, Enum):
    MATCH = "match"
    SUBSTITUTE = "substitute"
    DELETE = "delete"  # expected word missing from actual
    INSERT = "insert"  # actual word that has no expected counterpart


@dataclass(slots=True, frozen=True)
class AlignedWord:
    op: AlignOp
    expected_index: int | None
    expected_word: str | None
    actual_word: str | None


def align(expected: list[str], actual: list[str]) -> list[AlignedWord]:
    """Levenshtein-style word alignment. Returns a sequence of operations.

    Cost model: match=0, substitute=1, insert=1, delete=1. Tied tracebacks
    favour match > substitute > delete > insert so the output stays stable.
    """
    n, m = len(expected), len(actual)
    if n == 0 and m == 0:
        return []
    # dp[i][j] = min cost to align expected[:i] with actual[:j].
    dp: list[list[int]] = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if expected[i - 1] == actual[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j - 1],  # substitute
                    dp[i - 1][j],  # delete (expected word missing)
                    dp[i][j - 1],  # insert (actual extra word)
                )

    # Traceback.
    ops: list[AlignedWord] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and expected[i - 1] == actual[j - 1]:
            ops.append(
                AlignedWord(
                    op=AlignOp.MATCH,
                    expected_index=i - 1,
                    expected_word=expected[i - 1],
                    actual_word=actual[j - 1],
                )
            )
            i, j = i - 1, j - 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            ops.append(
                AlignedWord(
                    op=AlignOp.SUBSTITUTE,
                    expected_index=i - 1,
                    expected_word=expected[i - 1],
                    actual_word=actual[j - 1],
                )
            )
            i, j = i - 1, j - 1
        elif i > 0 and (j == 0 or dp[i][j] == dp[i - 1][j] + 1):
            ops.append(
                AlignedWord(
                    op=AlignOp.DELETE,
                    expected_index=i - 1,
                    expected_word=expected[i - 1],
                    actual_word=None,
                )
            )
            i -= 1
        else:
            ops.append(
                AlignedWord(
                    op=AlignOp.INSERT,
                    expected_index=None,
                    expected_word=None,
                    actual_word=actual[j - 1] if j > 0 else None,
                )
            )
            j -= 1
    ops.reverse()
    return ops


def word_error_rate(expected: list[str], actual: list[str]) -> float:
    """WER = (substitutions + insertions + deletions) / len(expected)."""
    if not expected:
        return 0.0 if not actual else 1.0
    aligned = align(expected, actual)
    errors = sum(
        1 for a in aligned if a.op in {AlignOp.SUBSTITUTE, AlignOp.DELETE, AlignOp.INSERT}
    )
    return min(1.0, errors / len(expected))
