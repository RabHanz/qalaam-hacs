#!/usr/bin/env python3
"""
Deep-pull tafsirs from alquran.cloud — 6 Arabic editions:
  ar.muyassar    Tafsīr al-Muyassar (already in DB)
  ar.jalalayn    Tafsīr al-Jalalayn
  ar.qurtubi     Tafsīr al-Qurṭubī
  ar.miqbas      Tanwīr al-Miqbās (Ibn ʿAbbās)
  ar.waseet      Al-Tafsīr al-Wasīṭ
  ar.baghawi     Tafsīr al-Baghawī

Plus the GitHub-hosted English ones we curated earlier (Maududi from
QUL etc.) — keep `ibn-kathir` (already in DB).
"""
from __future__ import annotations
import json, sqlite3, sys, time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
ALQURAN = "https://api.alquran.cloud/v1"

TARGETS = [
    # (alquran_id, our_slug, scholar_display)
    ("ar.muyassar",  "muyassar",  "Group of scholars (King Fahd Complex)"),
    ("ar.jalalayn",  "jalalayn",  "al-Mahallī & al-Suyūṭī"),
    ("ar.qurtubi",   "qurtubi",   "al-Qurṭubī"),
    ("ar.miqbas",    "miqbas",    "Ibn ʿAbbās (transmitted)"),
    ("ar.waseet",    "waseet",    "Tantāwī"),
    ("ar.baghawi",   "baghawi",   "al-Baghawī"),
]

def fetch(url: str, retries: int = 3) -> dict | None:
    for i in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                print(f"  ERR {url}: {e}", file=sys.stderr); return None
            time.sleep(1 + i)
    return None

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing"); return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pulled = 0; skipped = 0; failed = []

    for edition_id, slug, scholar in TARGETS:
        existing_count = conn.execute(
            "SELECT COUNT(*) FROM qalaam_v1_tafsirs WHERE slug=?", (slug,)
        ).fetchone()[0]
        if existing_count >= 6000:
            print(f"  skip {slug}: {existing_count} rows already")
            skipped += 1; continue
        print(f"  pull {edition_id} → {slug}")
        body = fetch(f"{ALQURAN}/quran/{edition_id}")
        if not body or "data" not in body:
            failed.append(edition_id); continue
        rows = []
        for s in body["data"].get("surahs", []):
            for a in s.get("ayahs", []):
                vk = f"{s['number']}:{a['numberInSurah']}"
                rows.append((slug, vk, a.get("text", "")))
        if not rows:
            failed.append(edition_id); continue
        conn.execute("DELETE FROM qalaam_v1_tafsirs WHERE slug=?", (slug,))
        conn.executemany(
            "INSERT INTO qalaam_v1_tafsirs (slug, verse_key, text) VALUES (?,?,?)",
            rows,
        )
        conn.execute(
            """INSERT OR REPLACE INTO qalaam_v1_tafsir_meta
               (slug, name, scholar, language, license_tag, attribution, verse_count, ingested_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                slug,
                body["data"].get("englishName", body["data"].get("name", edition_id)),
                scholar,
                "ar",
                "permissive-with-credit",
                f"{scholar} via alquran.cloud — {edition_id}",
                len(rows),
                now,
            ),
        )
        conn.commit()
        pulled += 1
        time.sleep(0.4)

    print()
    print(f"=== Done. pulled={pulled} skipped={skipped} failed={len(failed)} ===")
    if failed: print(f"failed: {failed}")
    print()
    print("=== Final state ===")
    for r in conn.execute(
        "SELECT slug, name, scholar, language, verse_count FROM qalaam_v1_tafsir_meta ORDER BY language, slug"
    ):
        print(f"  {r[0]:15s}  {r[1]:35s}  {r[2]:35s}  {r[3]}  ({r[4]} rows)")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
