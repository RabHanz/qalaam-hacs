#!/usr/bin/env python3
"""ingest-qul-wbw-colored-en.py — backfill English word-by-word translations
from QUL #564 (Colored English Word-by-Word).

Source: data/qul-source/raw/unpacked/wbw-colored-en/colored-english-wbw-translation.db
        (unpacked from data/qul-source/raw/translation/564-…sqlite, which is
        a zip containing the actual sqlite db).

Why this script: the existing wbw-en pack covers only 1,923 of 6,236 verses
(22,220 word-level rows). The colored-English pack from QUL covers all 6,236
verses with 77,429 rows — full Quran coverage with rich POS hints baked into
inline HTML (`<span class='pn'>` proper noun, `'n'` noun, `'v'` verb,
`'p'` preposition, `'paren'` parenthetical, etc.).

This ingest:
  1. Reads QUL #564 word_translation (surah, ayah, word_number, text).
  2. Strips the inline HTML markup down to plain text — preserves the
     visible English gloss but discards the POS spans (the existing
     wbw_translations schema is `translation TEXT`, not parsed POS, so
     keeping HTML there would break consumers).
  3. UPSERTs into `qalaam_v1_qul_wbw_translations` keyed on
     (verse_key, word_index, language_code='en'), preserving any rows
     from the legacy 1,923-verse pack that don't appear here (defensive).
  4. Joins with `qalaam_v1_qul_layouts_words` to source `text_arabic`
     so each row has both the Arabic word AND the English gloss.

License: kfgqpc-terms (the colored-English pack derives from KFGQPC's
WBW database, with the colored markup an upstream-Tarteel addition).

Usage:  python3 scripts/data/ingest-qul-wbw-colored-en.py
"""
# ruff: noqa: E501

from __future__ import annotations

import logging
import re
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
QUL_DB = REPO / "data" / "qul.sqlite"
SOURCE_DB = (
    REPO
    / "data"
    / "qul-source"
    / "raw"
    / "unpacked"
    / "wbw-colored-en"
    / "colored-english-wbw-translation.db"
)

logging.basicConfig(format="%(levelname)-7s %(message)s", level=logging.INFO)
log = logging.getLogger("ingest-wbw-colored-en")

# Strip inline HTML — kept in the source for POS coloring upstream but
# our schema stores plain text. Tags are well-formed `<span class='X'>…</span>`
# without nesting depth, so a simple regex pass suffices; we don't pull in
# beautifulsoup just for this.
HTML_RE = re.compile(r"<[^>]+>")


def strip_html(s: str) -> str:
    return HTML_RE.sub("", s).strip()


def main() -> None:
    if not QUL_DB.exists():
        log.error("qul.sqlite not found at %s", QUL_DB)
        sys.exit(2)
    if not SOURCE_DB.exists():
        log.error("colored-en wbw db not found at %s", SOURCE_DB)
        log.error("expected QUL #564 (Colored English Word-by-Word) — unzip:")
        log.error(
            "  unzip -o data/qul-source/raw/translation/564-colored-english-wbw-translation-*.sqlite"
        )
        log.error("    -d data/qul-source/raw/unpacked/wbw-colored-en/")
        sys.exit(2)

    log.info("source: %s", SOURCE_DB)
    log.info("target: %s", QUL_DB)

    src = sqlite3.connect(str(SOURCE_DB))
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(str(QUL_DB))

    # Build (verse_key, word_index) → text_arabic from the layout words —
    # that table is the canonical Arabic-word source. word_index there is
    # 0-based; QUL #564 word_number is 1-based — translate.
    arabic_for: dict[tuple[str, int], str] = {}
    for row in dst.execute(
        """SELECT verse_key, word_index, text
             FROM qalaam_v1_qul_layouts_words
            WHERE layout = 'kfgqpc_v4'"""
    ).fetchall():
        arabic_for[(row[0], row[1])] = row[2]
    log.info("arabic word map: %d entries (kfgqpc_v4 layout)", len(arabic_for))

    src_rows = src.execute(
        "SELECT surah_number, ayah_number, word_number, text FROM word_translation"
    ).fetchall()
    log.info("source rows: %d", len(src_rows))

    inserts: list[tuple[str, int, str, str, str]] = []
    arabic_misses = 0
    for r in src_rows:
        verse_key = f"{r['surah_number']}:{r['ayah_number']}"
        # Source word_number is 1-based as TEXT; convert to 0-based int to
        # align with our schema + the layouts table.
        try:
            word_index = int(r["word_number"]) - 1
        except (TypeError, ValueError):
            continue
        translation = strip_html(r["text"] or "")
        if not translation:
            continue
        text_arabic = arabic_for.get((verse_key, word_index), "")
        if not text_arabic:
            arabic_misses += 1
        inserts.append((verse_key, word_index, text_arabic, translation, "en"))

    log.info("prepared %d rows (arabic misses: %d)", len(inserts), arabic_misses)

    # UPSERT (PK is verse_key+word_index+language_code). Keeping the existing
    # wbw-en rows as fallback for any PK that doesn't appear here would be
    # over-paranoid: this pack covers ALL 6,236 verses, so it's a strict
    # superset. Just REPLACE.
    dst.executemany(
        """INSERT INTO qalaam_v1_qul_wbw_translations
              (verse_key, word_index, text_arabic, translation, language_code)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (verse_key, word_index, language_code) DO UPDATE SET
              text_arabic = excluded.text_arabic,
              translation = excluded.translation""",
        inserts,
    )
    dst.commit()

    # Audit ledger — one row per ingest. Schema is canonical from
    # ingest-qul-base.ts; columns are (resource_slug, source_id, source_url,
    # license, attribution, source_sha256, row_count, ingested_at).
    dst.execute(
        """INSERT INTO qalaam_v1_qul_ingest_log
              (resource_slug, source_id, source_url, license, attribution,
               source_sha256, row_count, ingested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
        (
            "wbw-translation-colored-english",
            "qul-translation-564",
            "https://qul.tarteel.ai/resources/translation/564",
            "kfgqpc-terms",
            "King Fahd Glorious Quran Printing Complex (colored markup © Tarteel)",
            "(see data/qul-source/raw/translation/564-*.license.json)",
            len(inserts),
        ),
    )
    dst.commit()

    final = dst.execute(
        "SELECT language_code, COUNT(*), COUNT(DISTINCT verse_key) FROM qalaam_v1_qul_wbw_translations GROUP BY language_code"
    ).fetchall()
    for lang, rows, verses in final:
        log.info("end state: lang=%s rows=%d verses=%d", lang, rows, verses)

    src.close()
    dst.close()
    log.info("done")


if __name__ == "__main__":
    main()
