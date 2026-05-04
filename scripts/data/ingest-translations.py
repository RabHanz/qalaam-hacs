#!/usr/bin/env python3
"""
Ingest English translation packs from alquran.cloud (mirror of fawazahmed0
public-domain editions) into qalaam_v1_translations.

Source format: {data: {surahs: [{number, ayahs: [{numberInSurah, text, ...}]}]}}
"""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
SRC = REPO / "data/translations-source"
DB = REPO / "data/qul.sqlite"

# Each tuple: (filename, slug, name, translator, license_tag, language)
PACKS = [
    ("pickthall.json", "pickthall",
     "The Meaning of the Glorious Quran", "Marmaduke Pickthall",
     "public-domain", "en"),
    ("saheeh-international.json", "saheeh-international",
     "Saheeh International", "Saheeh International",
     "permissive-with-credit", "en"),
    ("clear-quran.json", "clear-quran",
     "The Clear Quran", "Mustafa Khattab",
     "permissive-with-credit", "en"),
]


def main() -> int:
    if not DB.exists():
        print(f"ERR: missing {DB}", file=sys.stderr)
        return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_translations (
            slug       TEXT NOT NULL,
            verse_key  TEXT NOT NULL,
            text       TEXT NOT NULL,
            PRIMARY KEY (slug, verse_key)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_translation_meta (
            slug          TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            translator    TEXT NOT NULL,
            language      TEXT NOT NULL,
            license_tag   TEXT NOT NULL,
            attribution   TEXT NOT NULL,
            verse_count   INTEGER NOT NULL,
            ingested_at   TEXT NOT NULL
        )
        """
    )
    conn.commit()

    total = 0
    for filename, slug, name, translator, license_tag, lang in PACKS:
        path = SRC / filename
        if not path.exists():
            print(f"  skip {slug}: {path} missing")
            continue
        data = json.loads(path.read_text())
        surahs = data.get("data", {}).get("surahs", [])
        cur = conn.cursor()
        cur.execute("DELETE FROM qalaam_v1_translations WHERE slug = ?", (slug,))
        rows = 0
        for s in surahs:
            sn = int(s["number"])
            for a in s.get("ayahs", []):
                vk = f"{sn}:{int(a['numberInSurah'])}"
                txt = (a.get("text") or "").strip()
                if not txt:
                    continue
                cur.execute(
                    "INSERT OR REPLACE INTO qalaam_v1_translations (slug, verse_key, text) VALUES (?,?,?)",
                    (slug, vk, txt),
                )
                rows += 1
        cur.execute(
            """
            INSERT OR REPLACE INTO qalaam_v1_translation_meta
              (slug, name, translator, language, license_tag, attribution, verse_count, ingested_at)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (slug, name, translator, lang, license_tag,
             f"{translator} via alquran.cloud / fawazahmed0/quran-api",
             rows, datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")),
        )
        conn.commit()
        print(f"  {slug}: {rows} verses ingested ({license_tag})")
        total += rows

    conn.close()
    print(f"\n[done] {total} translation rows total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
