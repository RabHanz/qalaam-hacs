#!/usr/bin/env python3
"""
Deep-pull translations from alquran.cloud — public CDN with 123
translations across 30+ languages. Each translation = 6,236 verses
served via /v1/quran/<edition>. We ingest into qalaam_v1_translations
+ register meta in qalaam_v1_translation_meta with proper attribution.

License-aware per ADR-0020:
- Public-domain (Pickthall) → license_tag = 'public-domain'
- Permissive-with-credit (most modern) → 'permissive-with-credit'
- Restricted (Saheeh International commercial) → already in DB
We default to 'permissive-with-credit' for anything we can't classify;
each row carries the source name + name in its meta.

The script is INCREMENTAL — skips translations already in
qalaam_v1_translation_meta with the same edition slug.
"""
from __future__ import annotations
import json, sqlite3, sys, time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
ALQURAN = "https://api.alquran.cloud/v1"

PUBLIC_DOMAIN = {"en.pickthall", "en.yusufali", "en.shakir"}
RESTRICTED = {"en.saheeh"}  # Saheeh International — commercial; skip if not licensed

# Curate the priority list — top translations per language so we get
# breadth without bloating the DB. ~50 picked.
PRIORITY = [
    # English (10)
    "en.ahmedali", "en.ahmedraza", "en.arberry", "en.daryabadi",
    "en.hilali", "en.maududi", "en.pickthall", "en.qaribullah",
    "en.sahih", "en.yusufali", "en.shakir", "en.itani", "en.wahiduddin",
    # Arabic transliteration (1)
    "en.transliteration",
    # Urdu (5)
    "ur.ahmedali", "ur.jalandhry", "ur.junagarhi", "ur.kanzuliman", "ur.qadri",
    # French (4)
    "fr.hamidullah", "fr.boubakeur",
    # German (3)
    "de.aburida", "de.bubenheim", "de.khoury",
    # Spanish (2)
    "es.cortes", "es.bornez",
    # Indonesian / Bahasa (2)
    "id.indonesian", "id.muntakhab",
    # Turkish (4)
    "tr.diyanet", "tr.golpinarli", "tr.ozturk", "tr.transliteration",
    # Bengali
    "bn.bengali", "bn.hoque",
    # Russian
    "ru.kuliev", "ru.osmanov",
    # Chinese
    "zh.jian", "zh.majian",
    # Hindi / Tamil / Malayalam / Persian / Dutch / Bosnian / Albanian / Czech
    "fa.fooladvand", "fa.khorramdel", "fa.makarem",
    "ta.tamil", "ml.abdulhameed",
    "nl.keyzer", "nl.leemhuis", "bs.korkut",
    "sq.ahmeti", "sq.mehdiu",
    "cs.hrbek", "cs.nykl",
    "az.mammadaliyev",
    "ja.japanese", "ko.korean",
    "hi.hindi", "ku.asan",
    "ha.gumi", "so.abduh",
    "pt.elhayek", "it.piccardo",
    "sv.bernstrom", "no.berg",
]

def fetch(url: str, retries: int = 3) -> dict | None:
    for i in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                print(f"  ERR {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1 + i)
    return None

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr); return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")

    # Catalog
    cat = fetch(f"{ALQURAN}/edition?type=translation")
    if not cat or "data" not in cat:
        print("ERR: editions catalog fetch failed"); return 1
    available = {e["identifier"]: e for e in cat["data"]}
    print(f"alquran.cloud has {len(available)} translation editions")

    targets = [s for s in PRIORITY if s in available and s not in RESTRICTED]
    print(f"will pull {len(targets)} editions")

    # Existing rows
    existing = {row[0] for row in conn.execute("SELECT slug FROM qalaam_v1_translation_meta")}
    print(f"already in DB: {existing}")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pulled = 0
    skipped = 0
    failed = []

    for edition_id in targets:
        slug = edition_id.replace("en.", "").replace(".", "-")
        if slug in existing:
            skipped += 1
            continue
        meta = available[edition_id]
        print(f"  [{pulled+1}/{len(targets)}] {edition_id} → {slug} ({meta['language']}) {meta['name']}")
        body = fetch(f"{ALQURAN}/quran/{edition_id}")
        if not body or "data" not in body:
            failed.append(edition_id); continue
        verses_arr = body["data"].get("surahs", [])
        rows = []
        for s in verses_arr:
            for a in s.get("ayahs", []):
                vk = f"{s['number']}:{a['numberInSurah']}"
                rows.append((slug, vk, a.get("text", "")))
        if not rows:
            failed.append(edition_id); continue
        conn.execute("DELETE FROM qalaam_v1_translations WHERE slug = ?", (slug,))
        conn.executemany(
            "INSERT INTO qalaam_v1_translations (slug, verse_key, text) VALUES (?,?,?)",
            rows,
        )
        license_tag = "public-domain" if edition_id in PUBLIC_DOMAIN else "permissive-with-credit"
        conn.execute(
            """INSERT OR REPLACE INTO qalaam_v1_translation_meta
               (slug, name, translator, language, license_tag, attribution, verse_count, ingested_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                slug,
                meta.get("englishName", meta["name"]),
                meta.get("name", edition_id),
                meta["language"],
                license_tag,
                f"{meta.get('englishName', meta['name'])} via alquran.cloud — {edition_id}",
                len(rows),
                now,
            ),
        )
        conn.commit()
        pulled += 1
        time.sleep(0.4)  # be a polite citizen

    print()
    print(f"=== Done. pulled={pulled} skipped={skipped} failed={len(failed)} ===")
    if failed:
        print(f"failed: {failed[:8]}")

    print()
    print("=== Final state ===")
    for r in conn.execute(
        "SELECT language, COUNT(*) FROM qalaam_v1_translation_meta GROUP BY language ORDER BY COUNT(*) DESC"
    ):
        print(f"  {r[0]:5s} {r[1]} translations")
    print(f"  TOTAL: {conn.execute('SELECT COUNT(*) FROM qalaam_v1_translation_meta').fetchone()[0]}")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
