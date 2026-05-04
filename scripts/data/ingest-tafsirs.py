#!/usr/bin/env python3
"""Ingest tafsir packs from data/tafsirs-source/*.json into qalaam_v1_tafsirs."""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
SRC = REPO / "data/tafsirs-source"
DB = REPO / "data/qul.sqlite"

PACKS = [
    # (filename, slug, name, scholar, language, license_tag)
    ("muyassar.json", "muyassar",
     "Tafsir al-Muyassar", "Group of scholars (King Fahd Complex)",
     "ar", "public-domain"),
]


def main() -> int:
    if not DB.exists():
        print(f"ERR: missing {DB}", file=sys.stderr); return 2

    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_tafsirs (
            slug      TEXT NOT NULL,
            verse_key TEXT NOT NULL,
            text      TEXT NOT NULL,
            PRIMARY KEY (slug, verse_key)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_tafsir_meta (
            slug         TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            scholar      TEXT NOT NULL,
            language     TEXT NOT NULL,
            license_tag  TEXT NOT NULL,
            attribution  TEXT NOT NULL,
            verse_count  INTEGER NOT NULL,
            ingested_at  TEXT NOT NULL
        )
        """
    )

    total = 0
    for filename, slug, name, scholar, lang, license_tag in PACKS:
        path = SRC / filename
        if not path.exists():
            print(f"  skip {slug}: {path} missing"); continue
        data = json.loads(path.read_text())
        surahs = data.get("data", {}).get("surahs", [])
        cur = conn.cursor()
        cur.execute("DELETE FROM qalaam_v1_tafsirs WHERE slug = ?", (slug,))
        rows = 0
        for s in surahs:
            sn = int(s["number"])
            for a in s.get("ayahs", []):
                vk = f"{sn}:{int(a['numberInSurah'])}"
                txt = (a.get("text") or "").strip()
                if not txt: continue
                cur.execute(
                    "INSERT OR REPLACE INTO qalaam_v1_tafsirs (slug, verse_key, text) VALUES (?,?,?)",
                    (slug, vk, txt),
                )
                rows += 1
        cur.execute(
            """
            INSERT OR REPLACE INTO qalaam_v1_tafsir_meta
              (slug, name, scholar, language, license_tag, attribution, verse_count, ingested_at)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (slug, name, scholar, lang, license_tag,
             f"{scholar} via alquran.cloud",
             rows, datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")),
        )
        conn.commit()
        print(f"  {slug}: {rows} verses ({lang}, {license_tag})")
        total += rows

    conn.close()
    print(f"\n[done] {total} tafsir rows total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
