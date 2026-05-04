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

# Each layout uses a DIFFERENT script for its glyph text so switching
# layouts on the frontend produces a visibly different rendering. Without
# this, all three layouts pull from `uthmani_simple` and look identical.
#
#   madani_15  → uthmani         (full Uthmani with diacritics — KFGQPC v2)
#   kfgqpc_v1  → uthmani_simple  (simplified Uthmani — KFGQPC v1 has older
#                                 ortho without some diacritics)
#   kfgqpc_v4  → qpc_v4_tajweed  (Private-Use-Area glyph codes — only
#                                 renders authentically with the v4 font;
#                                 falls back gracefully with UthmanicHafs)
SCRIPT_FOR: dict[str, str] = {
    # madani_15 — full Uthmani with all diacritics (KFGQPC v2 baseline).
    "madani_15":  "uthmani",
    # kfgqpc_v1 — simplified Uthmani (older v1 ortho omits some marks);
    # subtly differs from v2 in diacritics on most pages.
    "kfgqpc_v1":  "uthmani_simple",
    # kfgqpc_v4 — uses readable Uthmani text + CSS tajweed-color overlay
    # (.mushaf-layout-tajweed) for the visual differentiation. The PUA
    # glyph codes from qpc_v4_tajweed exist in scripts_words but require
    # the proprietary v4 font to render — without it they show as tofu
    # boxes. We can swap once that font is licensed and self-hosted.
    "kfgqpc_v4":  "uthmani",
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

    print("[2] Building per-script global word-id indexes")
    # Build a separate global word-id index per script so each layout's
    # word IDs map to its OWN script's text. Word IDs are 1-based,
    # ordered by (surah, ayah, word_index).
    needed_scripts = set(SCRIPT_FOR.values())
    conn.executescript("DROP TABLE IF EXISTS _qalaam_global_word_ids;")
    conn.executescript(
        """
        CREATE TEMPORARY TABLE _qalaam_global_word_ids (
            script TEXT NOT NULL,
            word_id INTEGER NOT NULL,
            verse_key TEXT NOT NULL,
            word_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            PRIMARY KEY (script, word_id)
        );
        """
    )
    for script in needed_scripts:
        conn.execute(
            f"""
            INSERT INTO _qalaam_global_word_ids (script, word_id, verse_key, word_index, text)
            SELECT ?,
                ROW_NUMBER() OVER (
                    ORDER BY CAST(substr(verse_key, 1, instr(verse_key,':')-1) AS INTEGER) ASC,
                             CAST(substr(verse_key, instr(verse_key,':')+1) AS INTEGER) ASC,
                             word_index ASC
                ) AS word_id,
                verse_key,
                word_index,
                text
            FROM qalaam_v1_qul_scripts_words
            WHERE script = ?
            """,
            (script, script),
        )
        cnt = conn.execute(
            "SELECT COUNT(*) FROM _qalaam_global_word_ids WHERE script = ?",
            (script,),
        ).fetchone()[0]
        print(f"    {script:25s} {cnt} word ids")
    conn.execute("CREATE INDEX idx_gwid_script_id ON _qalaam_global_word_ids (script, word_id)")

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

            # For each ayah-line, expand the word_id range from this
            # layout's chosen script.
            script_for_layout = SCRIPT_FOR.get(canonical, "uthmani_simple")
            if line_type == "ayah" and fwid and lwid and fwid <= lwid:
                rows = conn.execute(
                    """
                    SELECT word_id, verse_key, word_index, text
                    FROM _qalaam_global_word_ids
                    WHERE script = ? AND word_id BETWEEN ? AND ?
                    ORDER BY word_id
                    """,
                    (script_for_layout, fwid, lwid),
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
