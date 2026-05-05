#!/usr/bin/env python3
"""ingest-qpc-v4-text.py — ingest KFGQPC V4 Tajweed PUA text into qul.sqlite.

Source: data/qul-source/raw/unpacked/qpc-v4.db (QUL #47, V4 Glyphs Word-by-Word).
The `words` table there has 83,668 rows of (id, location, surah, ayah, word, text)
where text is a single PUA codepoint U+FC41-U+FC64 — the per-page glyph index
that the matching V4 page font (QPCv4Page<N>) renders as a COLR/CPAL coloured
glyph (the canonical KFGQPC V4 Tajweed rendering).

This script:
  1. Creates `qalaam_v1_qul_qpc_v4_text` table (verse_key, word_index, text,
     page_number) with proper indices.
  2. Joins QUL's word_id with our existing layouts data to derive page_number
     (so the frontend knows which font family to use: QPCv4Page<page>).
  3. Writes 83,668 rows.

License: kfgqpc-terms (KFGQPC reuse terms — same as the V4 fonts).
Idempotent — clears + repopulates the table.

Usage:  python3 scripts/data/ingest-qpc-v4-text.py
"""
# ruff: noqa: E501

from __future__ import annotations

import logging
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
QUL_DB = REPO / "data" / "qul.sqlite"
SOURCE_DB = REPO / "data" / "qul-source" / "raw" / "unpacked" / "qpc-v4.db"

logging.basicConfig(format="%(levelname)-7s %(message)s", level=logging.INFO)
log = logging.getLogger("ingest-qpc-v4")


def main() -> None:
    if not QUL_DB.exists():
        log.error("qul.sqlite not found at %s", QUL_DB)
        sys.exit(2)
    if not SOURCE_DB.exists():
        log.error("V4 PUA source db not found at %s", SOURCE_DB)
        log.error("expected from QUL #47 (V4 Glyphs Word-by-Word).")
        sys.exit(2)

    log.info("connecting source: %s", SOURCE_DB)
    src = sqlite3.connect(str(SOURCE_DB))
    src.row_factory = sqlite3.Row

    log.info("connecting target: %s", QUL_DB)
    dst = sqlite3.connect(str(QUL_DB))

    # Schema: per-word PUA text + the page that font-family resolves to.
    dst.executescript("""
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_qpc_v4_text (
            verse_key   TEXT    NOT NULL,
            word_index  INTEGER NOT NULL,  -- 1-based, matches QUL `word` column
            text        TEXT    NOT NULL,  -- 1-char PUA codepoint U+FC41-U+FC64
            page_number INTEGER,           -- mushaf page (1-604) for font-family
            PRIMARY KEY (verse_key, word_index)
        );
        CREATE INDEX IF NOT EXISTS idx_qpc_v4_verse ON qalaam_v1_qul_qpc_v4_text (verse_key);
        CREATE INDEX IF NOT EXISTS idx_qpc_v4_page  ON qalaam_v1_qul_qpc_v4_text (page_number);
    """)

    # Read source rows
    src_rows = src.execute(
        "SELECT location, surah, ayah, word, text FROM words ORDER BY surah, ayah, word"
    ).fetchall()
    log.info("source rows: %d", len(src_rows))

    # Build word_id → page map from our existing layouts data
    page_for_word_id = {}
    for row in dst.execute(
        """SELECT word_id, page_number FROM qalaam_v1_qul_layouts_words
           WHERE layout = 'kfgqpc_v4'"""
    ).fetchall():
        page_for_word_id[row[0]] = row[1]
    log.info("V4 layout word→page map: %d entries", len(page_for_word_id))

    # Source uses `id` as the word_id (matches QUL convention)
    src_with_id = src.execute("SELECT id, location, surah, ayah, word, text FROM words").fetchall()

    dst.execute("DELETE FROM qalaam_v1_qul_qpc_v4_text")

    inserts = []
    missing_page = 0
    for r in src_with_id:
        word_id = r["id"]
        verse_key = f"{r['surah']}:{r['ayah']}"
        page = page_for_word_id.get(word_id)
        if page is None:
            missing_page += 1
        inserts.append((verse_key, r["word"], r["text"], page))

    dst.executemany(
        "INSERT INTO qalaam_v1_qul_qpc_v4_text (verse_key, word_index, text, page_number) VALUES (?, ?, ?, ?)",
        inserts,
    )
    dst.commit()
    log.info("inserted %d rows  (missing-page: %d)", len(inserts), missing_page)

    # Sanity
    by_verse = dict(
        dst.execute(
            "SELECT verse_key, COUNT(*) FROM qalaam_v1_qul_qpc_v4_text GROUP BY verse_key LIMIT 5"
        ).fetchall()
    )
    log.info("first 5 verse keys: %s", by_verse)

    # License audit ledger
    dst.execute(
        """INSERT OR REPLACE INTO qalaam_v1_qul_ingest_log
              (resource_id, ingest_label, license_tag, source_url, sha256, ingested_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))""",
        (
            "qul-quran-script-47-qpc-v4-pua",
            "qpc-v4-tajweed-pua-text",
            "kfgqpc-terms",
            "https://qul.tarteel.ai/resources/quran-script/47",
            "(see data/qul-source/raw/quran-script/47-*.license.json)",
        ),
    )
    dst.commit()

    src.close()
    dst.close()
    log.info("done")


if __name__ == "__main__":
    main()
