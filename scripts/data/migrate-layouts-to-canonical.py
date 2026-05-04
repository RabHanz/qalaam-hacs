#!/usr/bin/env python3
"""
Migrate the layouts ingested by `ingest-qul-extras.py` into the canonical
schema the data-loader's MushafLayoutsReader expects:

  qalaam_v1_qul_layouts_pages(layout, page_number, line_number, line_type,
                               alignment, first_word_id, last_word_id,
                               surah, lines_per_page)
  qalaam_v1_qul_layouts_words(layout, page_number, line_number, word_id,
                               word_index, verse_key, text)

The reader's MushafLayoutSlug enum names don't match QUL's resource ids,
so we alias on the way in:

  qpc-v2-15-lines     → madani_15      (KFGQPC v2 — what most apps call "Madani")
  qpc-v1-15-lines     → kfgqpc_v1
  qpc-v4-tajweed-15   → kfgqpc_v4

The words table is reconstructed from `qalaam_v1_qul_scripts_words` by
re-numbering globally in mushaf order (surah ASC, ayah ASC, word_index ASC),
since QUL's mushaf-layout exports refer to word_id as a global Quran-wide
counter starting at 1.

Idempotent — drops and recreates the canonical tables on each run.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
QUL_DB = REPO / "data/qul.sqlite"

ALIAS: dict[str, str] = {
    "qpc-v2-15-lines":   "madani_15",
    "qpc-v1-15-lines":   "kfgqpc_v1",
    "qpc-v4-tajweed-15": "kfgqpc_v4",
}


def main() -> int:
    if not QUL_DB.exists():
        print(f"ERR: {QUL_DB} missing", file=sys.stderr)
        return 2
    conn = sqlite3.connect(str(QUL_DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")

    print("[1] Dropping + recreating canonical layout tables")
    conn.executescript(
        """
        DROP TABLE IF EXISTS qalaam_v1_qul_layouts_pages;
        DROP TABLE IF EXISTS qalaam_v1_qul_layouts_words;

        CREATE TABLE qalaam_v1_qul_layouts_pages (
            layout         TEXT    NOT NULL,
            page_number    INTEGER NOT NULL,
            line_number    INTEGER NOT NULL,
            line_type      TEXT    NOT NULL,
            alignment      TEXT    NOT NULL,
            first_word_id  INTEGER,
            last_word_id   INTEGER,
            surah          INTEGER,
            lines_per_page INTEGER NOT NULL,
            PRIMARY KEY (layout, page_number, line_number)
        );
        CREATE TABLE qalaam_v1_qul_layouts_words (
            layout       TEXT    NOT NULL,
            page_number  INTEGER NOT NULL,
            line_number  INTEGER NOT NULL,
            word_id      INTEGER NOT NULL,
            word_index   INTEGER NOT NULL,
            verse_key    TEXT    NOT NULL,
            text         TEXT    NOT NULL,
            PRIMARY KEY (layout, word_id)
        );
        CREATE INDEX idx_layouts_words_verse
          ON qalaam_v1_qul_layouts_words (layout, verse_key, word_index);
        CREATE INDEX idx_layouts_words_line
          ON qalaam_v1_qul_layouts_words (layout, page_number, line_number, word_index);
        """
    )

    print("[2] Building global word-id index from scripts_words (uthmani_simple)")
    conn.executescript(
        """
        DROP TABLE IF EXISTS _qalaam_global_word_ids;
        CREATE TEMPORARY TABLE _qalaam_global_word_ids AS
        SELECT
            ROW_NUMBER() OVER (
                ORDER BY CAST(substr(verse_key, 1, instr(verse_key,':')-1) AS INTEGER) ASC,
                         CAST(substr(verse_key, instr(verse_key,':')+1) AS INTEGER) ASC,
                         word_index ASC
            ) AS word_id,
            verse_key,
            word_index,
            text
        FROM qalaam_v1_qul_scripts_words
        WHERE script = 'uthmani_simple';
        CREATE INDEX idx_gwid ON _qalaam_global_word_ids (word_id);
        """
    )
    total_words = conn.execute("SELECT COUNT(*) FROM _qalaam_global_word_ids").fetchone()[0]
    print(f"    {total_words} global word ids generated")

    pages_inserted = 0
    words_inserted = 0
    for src_layout_id, canonical in ALIAS.items():
        src_rows = list(conn.execute(
            """
            SELECT page_number, line_number, line_type, is_centered,
                   first_word_id, last_word_id, surah_number
            FROM qalaam_v1_qul_layouts_lines
            WHERE layout_id = ?
            ORDER BY page_number, line_number
            """,
            (src_layout_id,),
        ))
        if not src_rows:
            print(f"    skip {src_layout_id}: no rows in qalaam_v1_qul_layouts_lines")
            continue

        info = conn.execute(
            "SELECT lines_per_page, number_of_pages FROM qalaam_v1_qul_layouts_info WHERE layout_id = ?",
            (src_layout_id,),
        ).fetchone()
        lines_per_page = (info[0] if info else 15) or 15

        # Insert pages rows
        for page_n, line_n, line_type, is_centered, fwid, lwid, surah_n in src_rows:
            alignment = "centered" if is_centered else "justified"
            conn.execute(
                """
                INSERT OR REPLACE INTO qalaam_v1_qul_layouts_pages
                  (layout, page_number, line_number, line_type, alignment,
                   first_word_id, last_word_id, surah, lines_per_page)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (canonical, page_n, line_n, line_type, alignment, fwid, lwid, surah_n, lines_per_page),
            )
            pages_inserted += 1

            # For each ayah-line, expand the word_id range from the global index
            if line_type == "ayah" and fwid and lwid and fwid <= lwid:
                rows = conn.execute(
                    """
                    SELECT word_id, verse_key, word_index, text
                    FROM _qalaam_global_word_ids
                    WHERE word_id BETWEEN ? AND ?
                    ORDER BY word_id
                    """,
                    (fwid, lwid),
                ).fetchall()
                for word_id, verse_key, word_index, text in rows:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO qalaam_v1_qul_layouts_words
                          (layout, page_number, line_number, word_id, word_index, verse_key, text)
                        VALUES (?,?,?,?,?,?,?)
                        """,
                        (canonical, page_n, line_n, word_id, word_index, verse_key, text),
                    )
                    words_inserted += 1

        print(f"    {src_layout_id} → {canonical}: {len(src_rows)} lines, lines_per_page={lines_per_page}")

    conn.commit()
    print(f"\n[done] pages_rows={pages_inserted}  words_rows={words_inserted}")
    print("Canonical layouts available:")
    for row in conn.execute(
        """SELECT layout, MAX(page_number), COUNT(*) AS lines
           FROM qalaam_v1_qul_layouts_pages GROUP BY layout"""
    ):
        print(f"  {row[0]:20s}  pages={row[1]:<4d}  lines={row[2]}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
