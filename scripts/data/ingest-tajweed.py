#!/usr/bin/env python3
"""
Ingest tajweed annotations from cpfair/quran-tajweed (open-source MIT
licensed) into the backend. Each annotation specifies a (start, end)
char range in the verse's Hafs Uthmani text and the tajweed rule that
applies to that range.

Source format (per ayah):
  {"surah":1, "ayah":1, "annotations":[{"rule":"hamzat_wasl","start":7,"end":8}, ...]}

We store ALL 6236 ayahs × 60,057 annotations × 18 rule types so the
frontend can render ACCURATE tajweed coloring on the v4 layout —
not a regex approximation.

Reference: https://github.com/cpfair/quran-tajweed
"""
from __future__ import annotations
import json, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path("/home/onnyx/qalam")
DB = REPO / "data/qul.sqlite"
SRC = REPO / "data/tajweed-source/tajweed.hafs.uthmani-pause-sajdah.json"

def main() -> int:
    if not DB.exists() or not SRC.exists():
        print(f"ERR: missing {DB if not DB.exists() else SRC}", file=sys.stderr)
        return 2

    with SRC.open() as f:
        data = json.load(f)
    print(f"loaded {len(data)} ayahs from {SRC.name}")

    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("""
        DROP TABLE IF EXISTS qalaam_v1_tajweed_annotations;
    """)
    conn.execute("""
        CREATE TABLE qalaam_v1_tajweed_annotations (
            verse_key TEXT NOT NULL,
            start_idx INTEGER NOT NULL,
            end_idx   INTEGER NOT NULL,
            rule      TEXT NOT NULL
        );
    """)
    conn.execute("CREATE INDEX idx_tajweed_vk ON qalaam_v1_tajweed_annotations (verse_key)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS qalaam_v1_tajweed_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)

    rows = []
    rules_seen = set()
    for item in data:
        verse_key = f"{item['surah']}:{item['ayah']}"
        for a in item.get("annotations", []):
            rule = a["rule"]
            rules_seen.add(rule)
            rows.append((verse_key, a["start"], a["end"], rule))
    conn.executemany(
        "INSERT INTO qalaam_v1_tajweed_annotations (verse_key, start_idx, end_idx, rule) VALUES (?,?,?,?)",
        rows,
    )
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute(
        "INSERT OR REPLACE INTO qalaam_v1_tajweed_meta (key, value) VALUES ('ingested_at', ?)",
        (now,),
    )
    conn.execute(
        "INSERT OR REPLACE INTO qalaam_v1_tajweed_meta (key, value) VALUES ('source', ?)",
        ("cpfair/quran-tajweed (MIT) — Hafs Uthmani with pause + sajdah",),
    )
    conn.commit()

    # Verify
    cnt = conn.execute("SELECT COUNT(*) FROM qalaam_v1_tajweed_annotations").fetchone()[0]
    rcnt = conn.execute("SELECT COUNT(DISTINCT rule) FROM qalaam_v1_tajweed_annotations").fetchone()[0]
    vcnt = conn.execute("SELECT COUNT(DISTINCT verse_key) FROM qalaam_v1_tajweed_annotations").fetchone()[0]
    print(f"  inserted {cnt} annotations across {vcnt} verses, {rcnt} distinct rules")
    print(f"  rules: {sorted(rules_seen)}")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
