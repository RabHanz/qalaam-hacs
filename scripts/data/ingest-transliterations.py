#!/usr/bin/env python3
"""
Ingest transliteration editions from alquran.cloud — phonetic Arabic
in Latin / Turkish / Cyrillic / etc. scripts. Surfaces as an opt-in
strip under each ayah on /read for non-Arabic-readers (and as a
study aid for early-stage Arabic learners).

Sources (3 editions as of 2026-05):
  - en.transliteration  → English Latin transliteration (Yusuf Ali style)
  - tr.transliteration  → Turkish "Ceviriyazi" (Muhammet Abay)
  - ru.transliteration  → Russian Cyrillic transliteration

Stored in `qalaam_v1_transliterations` (verse_key + slug PK) +
`qalaam_v1_transliteration_meta` (one row per edition with attribution).
Both keep schema parallel to qalaam_v1_translations* so route handlers
share the same shape.

License: alquran.cloud surfaces these as community contributions; we
record them as `permissive-with-credit` with the explicit translator
and source URL embedded in the meta row. Per ADR-0020, the route
returns the meta with every response so consumers always have
attribution next to the text.

Idempotent: re-runs skip slugs that already have a meta row.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import time
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
ALQURAN = "https://api.alquran.cloud/v1"

EDITIONS = [
    "en.transliteration",
    "tr.transliteration",
    "ru.transliteration",
]


def fetch(url: str, retries: int = 3) -> dict | None:
    for i in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310 — fixed CDN
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                print(f"  ERR {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1 + i)
    return None


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_transliterations (
          slug      TEXT NOT NULL,
          verse_key TEXT NOT NULL,
          text      TEXT NOT NULL,
          PRIMARY KEY (slug, verse_key)
        );
        CREATE TABLE IF NOT EXISTS qalaam_v1_transliteration_meta (
          slug         TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          translator   TEXT NOT NULL,
          language     TEXT NOT NULL,
          license_tag  TEXT NOT NULL,
          attribution  TEXT NOT NULL,
          verse_count  INTEGER NOT NULL,
          ingested_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_transliterations_slug ON qalaam_v1_transliterations(slug);
        """
    )


def main() -> int:  # noqa: PLR0915 — straight-line ingest pipeline; no clean split.
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr)
        return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    ensure_schema(conn)

    catalog = fetch(f"{ALQURAN}/edition?type=transliteration")
    if not catalog or "data" not in catalog:
        print("ERR: catalog fetch failed", file=sys.stderr)
        return 1
    available = {e["identifier"]: e for e in catalog["data"]}
    print(f"alquran.cloud has {len(available)} transliteration editions")

    existing = {row[0] for row in conn.execute("SELECT slug FROM qalaam_v1_transliteration_meta")}
    print(f"already in DB: {existing or '∅'}")

    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    pulled = 0
    skipped = 0
    failed: list[str] = []

    for edition_id in EDITIONS:
        if edition_id not in available:
            print(f"  ! {edition_id} not in catalog — skip")
            failed.append(edition_id)
            continue
        # Slug = drop the language prefix when it's identical to the kind
        # so en.transliteration → 'transliteration' (default), and
        # tr/ru variants get 'tr-transliteration' / 'ru-transliteration'.
        lang = edition_id.split(".", 1)[0]
        slug = "transliteration" if lang == "en" else f"{lang}-transliteration"
        if slug in existing:
            print(f"  ✓ {slug} already present — skip")
            skipped += 1
            continue
        meta = available[edition_id]
        print(f"  [{pulled + 1}] {edition_id} → {slug} ({lang}) {meta.get('name', '')}")
        body = fetch(f"{ALQURAN}/quran/{edition_id}")
        if not body or "data" not in body:
            failed.append(edition_id)
            continue
        rows: list[tuple[str, str, str]] = []
        for s in body["data"].get("surahs", []):
            for a in s.get("ayahs", []):
                vk = f"{s['number']}:{a['numberInSurah']}"
                txt = (a.get("text") or "").strip()
                if txt:
                    rows.append((slug, vk, txt))
        if not rows:
            failed.append(edition_id)
            continue
        conn.execute("DELETE FROM qalaam_v1_transliterations WHERE slug = ?", (slug,))
        conn.executemany(
            "INSERT INTO qalaam_v1_transliterations (slug, verse_key, text) VALUES (?,?,?)",
            rows,
        )
        eng_name = meta.get("englishName", meta.get("name", edition_id))
        attribution = f"{eng_name} via alquran.cloud - {edition_id}"
        conn.execute(
            """INSERT OR REPLACE INTO qalaam_v1_transliteration_meta
               (slug, name, translator, language, license_tag,
                attribution, verse_count, ingested_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                slug,
                eng_name,
                meta.get("name", edition_id),
                lang,
                "permissive-with-credit",
                attribution,
                len(rows),
                now,
            ),
        )
        conn.commit()
        pulled += 1
        time.sleep(0.4)

    print()
    print(f"=== Done. pulled={pulled} skipped={skipped} failed={len(failed)} ===")
    if failed:
        print(f"failed: {failed}")

    print()
    print("=== Final state ===")
    final_q = (
        "SELECT slug, language, verse_count "
        "FROM qalaam_v1_transliteration_meta "
        "ORDER BY language, slug"
    )
    for r in conn.execute(final_q):
        print(f"  {r[0]:25s} {r[1]:3s} {r[2]} verses")
    total = conn.execute("SELECT COUNT(*) FROM qalaam_v1_transliterations").fetchone()[0]
    print(f"  TOTAL rows: {total}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
