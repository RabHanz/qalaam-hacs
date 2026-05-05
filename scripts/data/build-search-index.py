#!/usr/bin/env python3
"""
Build FTS5 search indexes over Quran text + translations + topics.

Three indexes (separate so we can score + rank results per type):
  - qalaam_v1_search_verses_fts     (Arabic Uthmani + Imlaei + IndoPak)
  - qalaam_v1_search_translations_fts (every translation row, language-tagged)
  - qalaam_v1_search_topics_fts     (curated topic names + summaries)

Each is a contentless FTS5 virtual table with custom tokenizer
'unicode61 remove_diacritics 2' so Arabic harakat + Latin diacritics
don't break matches.

Idempotent: drops + recreates each index on every run. Safe to re-run.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")


def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr)
        return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")

    # --- Verses (Arabic) -------------------------------------------
    print("dropping + rebuilding qalaam_v1_search_verses_fts")
    conn.executescript(
        """
        DROP TABLE IF EXISTS qalaam_v1_search_verses_fts;
        CREATE VIRTUAL TABLE qalaam_v1_search_verses_fts USING fts5(
          verse_key UNINDEXED,
          surah UNINDEXED,
          ayah UNINDEXED,
          text_uthmani,
          text_imlaei,
          text_indopak,
          tokenize = 'unicode61 remove_diacritics 2'
        );
        """
    )
    rows = list(
        conn.execute(
            """SELECT verse_key, surah, ayah, text_uthmani, text_imlaei, text_indopak
               FROM qalaam_v1_verses"""
        )
    )
    conn.executemany(
        """INSERT INTO qalaam_v1_search_verses_fts
           (verse_key, surah, ayah, text_uthmani, text_imlaei, text_indopak)
           VALUES (?,?,?,?,?,?)""",
        rows,
    )
    conn.commit()
    print(f"  indexed {len(rows)} verses")

    # --- Translations ---------------------------------------------
    print("dropping + rebuilding qalaam_v1_search_translations_fts")
    conn.executescript(
        """
        DROP TABLE IF EXISTS qalaam_v1_search_translations_fts;
        CREATE VIRTUAL TABLE qalaam_v1_search_translations_fts USING fts5(
          slug UNINDEXED,
          verse_key UNINDEXED,
          language UNINDEXED,
          text,
          tokenize = 'unicode61 remove_diacritics 2'
        );
        """
    )
    n = 0
    cur = conn.execute(
        """SELECT t.slug, t.verse_key, m.language, t.text
           FROM qalaam_v1_translations t
           LEFT JOIN qalaam_v1_translation_meta m ON m.slug = t.slug"""
    )
    batch_size = 5000
    batch: list[tuple[str, str, str | None, str]] = []
    for row in cur:
        batch.append(row)
        if len(batch) >= batch_size:
            conn.executemany(
                """INSERT INTO qalaam_v1_search_translations_fts
                   (slug, verse_key, language, text) VALUES (?,?,?,?)""",
                batch,
            )
            n += len(batch)
            batch = []
    if batch:
        conn.executemany(
            """INSERT INTO qalaam_v1_search_translations_fts
               (slug, verse_key, language, text) VALUES (?,?,?,?)""",
            batch,
        )
        n += len(batch)
    conn.commit()
    print(f"  indexed {n} translation rows")

    # --- Topics ---------------------------------------------------
    print("dropping + rebuilding qalaam_v1_search_topics_fts")
    conn.executescript(
        """
        DROP TABLE IF EXISTS qalaam_v1_search_topics_fts;
        CREATE VIRTUAL TABLE qalaam_v1_search_topics_fts USING fts5(
          slug UNINDEXED,
          name_en,
          name_ar,
          summary,
          tokenize = 'unicode61 remove_diacritics 2'
        );
        """
    )
    rows = list(
        conn.execute(
            """SELECT slug, name_en, COALESCE(name_ar, ''), COALESCE(summary, '')
               FROM qalaam_v1_qul_topics WHERE parent_id IS NOT NULL"""
        )
    )
    conn.executemany(
        """INSERT INTO qalaam_v1_search_topics_fts
           (slug, name_en, name_ar, summary) VALUES (?,?,?,?)""",
        rows,
    )
    conn.commit()
    print(f"  indexed {len(rows)} topics")

    # --- Final state ---------------------------------------------
    print()
    print("=== Final state ===")
    # Safelist of table names — sqlite3 doesn't bind table identifiers, so
    # the f-string is safe ONLY because each candidate is a literal string
    # constant under our control.
    safelist = {
        "qalaam_v1_search_verses_fts",
        "qalaam_v1_search_translations_fts",
        "qalaam_v1_search_topics_fts",
    }
    for tbl in sorted(safelist):
        if tbl not in safelist:
            continue
        c = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]  # noqa: S608
        print(f"  {tbl:48s} {c}")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
