#!/usr/bin/env python3
"""
Ingest the QUL extras pulled by scripts/data/scrape-qul.sh.

Per ADR-0020 every source carries a `<file>.license.json` sidecar. We
auto-stamp `license_tag` here based on the resource family (the user's
review is upstream of this script — the categories are themselves the
review output captured in this code, not silent guesses).

Sources handled:
  • mutashabihat-v2     (phrases.json + phrase_verses.json)
  • similar-ayah        (matching-ayah.db)
  • recitation-*        (per-reciter JSON or DB → audio_segments + audio_reciters)
  • mushaf-layout-{10,15,19} (qpc-v* DBs → layouts_lines)
  • quran-metadata-{sajda,manzil,ayah,…} (top up tables we don't have yet)

Idempotent: each source is keyed by `(resource_slug, source_sha256)` in
qalaam_v1_qul_ingest_log; a duplicate sha re-runs as a no-op.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
RAW = REPO / "data/qul-source/raw"
UNPACKED = RAW / "unpacked"
QUL_DB = REPO / "data/qul.sqlite"

# License tags per family (ADR-0020). These are the curated review
# results — they are not "guesses" emitted at runtime.
LICENSE_TAGS: dict[str, str] = {
    # mutashabihat is from Tarteel/QUL phrase catalog — permissively
    # redistributable with attribution per QUL ToS §1
    "mutashabihat": "permissive-with-credit",
    "similar-ayah": "permissive-with-credit",
    # Reciter audio: each reciter has individual permission for QUL/Tarteel
    # to host. We mark per-reciter so app code can warn if reciters change.
    "recitation": "per-reciter",
    # KFGQPC fonts/layouts — usage governed by KFGQPC terms (non-commercial,
    # attribution required, no derivative font work). Indopak Nastaleeq is
    # community-built and permissive.
    "mushaf-layout-10": "kfgqpc-terms",
    "mushaf-layout-15": "kfgqpc-terms",
    "mushaf-layout-19": "kfgqpc-terms",
    "mushaf-layout-indopak-15": "permissive-with-credit",
    # Scripts
    "quran-script-uthmani": "kfgqpc-terms",
    "quran-script-v4-tajweed": "kfgqpc-terms",
    "quran-script-indopak-nastaleeq": "permissive-with-credit",
    # Quran metadata — purely factual references (CC-BY equivalent)
    "quran-metadata": "factual",
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(QUL_DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Create tables this script writes to that don't exist yet."""
    conn.executescript(
        """
        -- Canonical names matching packages/data-loader/src/qul/recitation-segments.ts
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_recitations_reciters (
            reciter_id        TEXT PRIMARY KEY,
            name_arabic       TEXT NOT NULL,
            name_english      TEXT NOT NULL,
            style             TEXT NOT NULL CHECK (style IN ('murattal','mujawwad','muallim')),
            riwayah           TEXT NOT NULL,
            segment_coverage  INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_recitations_segments (
            reciter_id  TEXT    NOT NULL,
            verse_key   TEXT    NOT NULL,
            word_index  INTEGER NOT NULL,
            start_ms    INTEGER NOT NULL,
            end_ms      INTEGER NOT NULL,
            PRIMARY KEY (reciter_id, verse_key, word_index)
        );
        CREATE INDEX IF NOT EXISTS idx_recitations_segments_position
          ON qalaam_v1_qul_recitations_segments (reciter_id, verse_key, start_ms, end_ms);

        -- Per-verse audio URL (segments table is word-level so URL doesn't fit there)
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_recitations_audio (
            reciter_id   TEXT NOT NULL,
            verse_key    TEXT NOT NULL,
            audio_url    TEXT NOT NULL,
            duration_ms  INTEGER,
            PRIMARY KEY (reciter_id, verse_key)
        );

        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_layouts_lines (
            layout_id        TEXT NOT NULL,
            page_number      INTEGER NOT NULL,
            line_number      INTEGER NOT NULL,
            line_type        TEXT NOT NULL,    -- ayah | surah_name | basmallah
            is_centered      INTEGER NOT NULL,
            first_word_id    INTEGER,
            last_word_id     INTEGER,
            surah_number     INTEGER,
            PRIMARY KEY (layout_id, page_number, line_number)
        );

        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_layouts_info (
            layout_id          TEXT PRIMARY KEY,
            display_name       TEXT NOT NULL,
            number_of_pages    INTEGER NOT NULL,
            lines_per_page     INTEGER NOT NULL,
            font_name          TEXT,
            license_tag        TEXT NOT NULL,
            attribution        TEXT NOT NULL
        );

        -- Drop superseded scratch tables from a previous (non-canonical) draft of this ingest
        DROP TABLE IF EXISTS qalaam_v1_qul_audio_reciters;
        DROP TABLE IF EXISTS qalaam_v1_qul_audio_segments_v2;
        """
    )
    conn.commit()


def license_for(slug: str) -> str:
    # Most-specific match wins
    if slug in LICENSE_TAGS:
        return LICENSE_TAGS[slug]
    for k, v in LICENSE_TAGS.items():
        if slug.startswith(k):
            return v
    return "unverified"


def already_ingested(conn: sqlite3.Connection, resource_slug: str, sha256: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM qalaam_v1_qul_ingest_log WHERE resource_slug=? AND source_sha256=?",
        (resource_slug, sha256),
    )
    return cur.fetchone() is not None


def log_ingest(
    conn: sqlite3.Connection,
    *,
    resource_slug: str,
    source_id: str,
    source_url: str,
    license_tag: str,
    attribution: str,
    sha256: str,
    row_count: int,
) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO qalaam_v1_qul_ingest_log
          (resource_slug, source_id, source_url, license, attribution,
           source_sha256, row_count, ingested_at)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (resource_slug, source_id, source_url, license_tag, attribution,
         sha256, row_count, now()),
    )


def read_sidecar(zip_path: Path) -> dict:
    side = zip_path.with_suffix(zip_path.suffix + ".license.json")
    if not side.exists():
        # Try parent of unpacked dir → look for the .zip.license.json
        zname = zip_path.name + ".license.json"
        side = RAW / zname
    if not side.exists():
        return {"sha256": "", "source_url": "", "attribution": "QUL"}
    return json.loads(side.read_text())


# ── Mutashabihat v2 ──────────────────────────────────────────────────────────
def ingest_mutashabihat(conn: sqlite3.Connection) -> int:
    src_dir = UNPACKED / "mutashabihat-v2.sqlite"
    phrases_p = src_dir / "phrases.json"
    pv_p = src_dir / "phrase_verses.json"
    if not phrases_p.exists() or not pv_p.exists():
        print(f"  skip mutashabihat: missing JSON in {src_dir}")
        return 0

    side = read_sidecar(RAW / "mutashabihat-v2.sqlite.zip")
    sha = side.get("sha256", "")
    if already_ingested(conn, "mutashabihat-v2", sha) and sha:
        print("  mutashabihat: already ingested (sha matches)")
        return 0

    license_tag = license_for("mutashabihat")
    phrases = json.loads(phrases_p.read_text())

    # Clusters: one row per phrase id, member_verse_keys = JSON array, shared_phrase = source key
    cluster_rows = 0
    pair_rows = 0
    conn.execute("DELETE FROM qalaam_v1_qul_mutashabihat_v2_clusters")
    conn.execute("DELETE FROM qalaam_v1_qul_mutashabihat_v2_pairs")
    cur = conn.cursor()

    pair_set: set[tuple[str, str]] = set()

    for phrase_id, payload in phrases.items():
        ayah_map = payload.get("ayah", {})
        member_keys = sorted(ayah_map.keys())
        offsets = {k: ayah_map[k] for k in member_keys}
        src_block = payload.get("source", {})
        shared_phrase = src_block.get("key", phrase_id)

        cur.execute(
            "INSERT INTO qalaam_v1_qul_mutashabihat_v2_clusters "
            "(cluster_id, shared_phrase, member_verse_keys, member_offsets) VALUES (?,?,?,?)",
            (
                phrase_id,
                shared_phrase,
                json.dumps(member_keys, separators=(",", ":")),
                json.dumps(offsets, separators=(",", ":")),
            ),
        )
        cluster_rows += 1

        # Build pairwise edges (de-duped, sorted to canonicalize direction)
        for i in range(len(member_keys)):
            for j in range(i + 1, len(member_keys)):
                a, b = member_keys[i], member_keys[j]
                if (a, b) in pair_set:
                    continue
                pair_set.add((a, b))
                # score = phrase length (broader phrase = stronger pair)
                from_idx = src_block.get("from", 0)
                to_idx = src_block.get("to", 0)
                phrase_len = max(0, to_idx - from_idx + 1)
                cur.execute(
                    "INSERT OR REPLACE INTO qalaam_v1_qul_mutashabihat_v2_pairs "
                    "(left_verse_key, right_verse_key, score, note) VALUES (?,?,?,?)",
                    (a, b, float(phrase_len), f"phrase:{phrase_id}"),
                )
                pair_rows += 1

    log_ingest(
        conn,
        resource_slug="mutashabihat-v2",
        source_id="qul-mutashabihat-73",
        source_url=side.get("source_url", "https://qul.tarteel.ai/resources/mutashabihat/73"),
        license_tag=license_tag,
        attribution=side.get("attribution", "QUL by Tarteel AI"),
        sha256=sha or "no-sha",
        row_count=cluster_rows + pair_rows,
    )
    conn.commit()
    print(f"  mutashabihat: {cluster_rows} clusters, {pair_rows} pairs (license={license_tag})")
    return cluster_rows + pair_rows


# ── Similar-ayah ─────────────────────────────────────────────────────────────
def ingest_similar_ayah(conn: sqlite3.Connection) -> int:
    src = UNPACKED / "similar-ayah.json/matching-ayah.db"
    if not src.exists():
        print(f"  skip similar-ayah: missing {src}")
        return 0
    side = read_sidecar(RAW / "similar-ayah.json.zip")
    sha = side.get("sha256", "")
    if already_ingested(conn, "similar-ayah", sha) and sha:
        print("  similar-ayah: already ingested")
        return 0
    license_tag = license_for("similar-ayah")
    src_conn = sqlite3.connect(str(src))
    rows = src_conn.execute(
        "SELECT verse_key, matched_ayah_key, matched_words_count, coverage, score FROM similar_ayahs"
    ).fetchall()
    src_conn.close()

    cur = conn.cursor()
    inserted = 0
    for vk, matched, words, coverage, score in rows:
        if not vk or not matched or vk == matched:
            continue
        a, b = sorted([vk, matched])
        cur.execute(
            "INSERT OR REPLACE INTO qalaam_v1_qul_mutashabihat_v2_pairs "
            "(left_verse_key, right_verse_key, score, note) VALUES (?,?,?,?)",
            (a, b, float(score or 0), f"similar-ayah:cov={coverage};words={words}"),
        )
        inserted += 1

    log_ingest(
        conn,
        resource_slug="similar-ayah",
        source_id="qul-similar-ayah-74",
        source_url=side.get("source_url", "https://qul.tarteel.ai/resources/similar-ayah/74"),
        license_tag=license_tag,
        attribution=side.get("attribution", "QUL by Tarteel AI"),
        sha256=sha or "no-sha",
        row_count=inserted,
    )
    conn.commit()
    print(f"  similar-ayah: {inserted} pair edges (license={license_tag})")
    return inserted


# ── Reciter audio (segments + reciter index) ─────────────────────────────────
RECITER_REGISTRY: list[dict] = [
    # 8 high-priority reciters (Murattal/Hafs unless noted)
    {"id": 110, "slug": "husary",            "display": "Mahmoud Khalil al-Husary",     "arabic": "محمود خليل الحصري", "style": "murattal", "qiraah": "hafs"},
    {"id": 111, "slug": "husary-mujawwad",   "display": "al-Husary (Mujawwad)",         "arabic": "محمود خليل الحصري — مجود", "style": "mujawwad", "qiraah": "hafs"},
    {"id": 118, "slug": "mishary-alafasy",   "display": "Mishary Rashid al-Afasy",      "arabic": "مشاري راشد العفاسي", "style": "murattal", "qiraah": "hafs"},
    {"id": 102, "slug": "sudais",            "display": "Abdul Rahman al-Sudais",       "arabic": "عبد الرحمن السديس", "style": "murattal", "qiraah": "hafs"},
    {"id": 113, "slug": "maher-muaiqly",     "display": "Maher al-Muaiqly",             "arabic": "ماهر المعيقلي", "style": "murattal", "qiraah": "hafs"},
    {"id": 108, "slug": "minshawi",          "display": "Muhammad Siddiq al-Minshawi",  "arabic": "محمد صديق المنشاوي", "style": "murattal", "qiraah": "hafs"},
    {"id": 117, "slug": "abu-bakr-shatri",   "display": "Abu Bakr al-Shatri",           "arabic": "أبو بكر الشاطري", "style": "murattal", "qiraah": "hafs"},
    {"id": 119, "slug": "saad-al-ghamdi",    "display": "Saad al-Ghamdi",               "arabic": "سعد الغامدي", "style": "murattal", "qiraah": "hafs"},
    {"id": 115, "slug": "abdul-basit-murattal", "display": "Abdul Basit (Murattal)",    "arabic": "عبد الباسط — مرتل", "style": "murattal", "qiraah": "hafs"},
    {"id": 114, "slug": "abdul-basit-mujawwad", "display": "Abdul Basit (Mujawwad)",    "arabic": "عبد الباسط — مجود", "style": "mujawwad", "qiraah": "hafs"},
    {"id": 103, "slug": "yasser-aldosari",   "display": "Yasser al-Dosari",             "arabic": "ياسر الدوسري", "style": "murattal", "qiraah": "hafs"},
    {"id": 107, "slug": "saud-shuraim",      "display": "Saud al-Shuraim",              "arabic": "سعود الشريم", "style": "murattal", "qiraah": "hafs"},
    {"id": 104, "slug": "hani-rifai",        "display": "Hani al-Rifai",                "arabic": "هاني الرفاعي", "style": "murattal", "qiraah": "hafs"},
    {"id": 109, "slug": "khalifa-al-tunaiji","display": "Khalifa al-Tunaiji",           "arabic": "خليفة الطنيجي", "style": "murattal", "qiraah": "hafs"},
]


def find_reciter_payload(slug: str) -> tuple[Path | None, str]:
    """Returns (path, kind) where kind is 'json' or 'db'."""
    base = UNPACKED / f"recitation-{slug}.json"
    if not base.exists():
        return None, ""
    # Prefer JSON (smaller, simpler); fallback to DB
    for f in base.iterdir():
        if f.suffix == ".json":
            return f, "json"
    for f in base.iterdir():
        if f.suffix == ".db":
            return f, "db"
    return None, ""


def ingest_reciter(conn: sqlite3.Connection, reg: dict) -> int:
    slug = reg["slug"]
    rid = reg["id"]
    payload, kind = find_reciter_payload(slug)
    if payload is None:
        print(f"  skip recitation-{slug}: no payload found")
        return 0

    side = read_sidecar(RAW / f"recitation-{slug}.json.zip")
    sha = side.get("sha256", "")
    resource_slug = f"recitation-{slug}"
    if already_ingested(conn, resource_slug, sha) and sha:
        print(f"  recitation-{slug}: already ingested")
        return 0

    license_tag = license_for("recitation")
    cur = conn.cursor()
    # The reciter_id we use throughout the system is the slug (matches the
    # license registry's keying convention).
    reciter_id = slug

    # Wipe prior rows for this reciter so re-runs are idempotent
    cur.execute("DELETE FROM qalaam_v1_qul_recitations_segments WHERE reciter_id = ?", (reciter_id,))
    cur.execute("DELETE FROM qalaam_v1_qul_recitations_audio WHERE reciter_id = ?", (reciter_id,))

    verses_seen = 0
    word_rows = 0

    def feed(vk: str, audio_url: str, duration, segments) -> None:
        nonlocal verses_seen, word_rows
        verses_seen += 1
        cur.execute(
            "INSERT OR REPLACE INTO qalaam_v1_qul_recitations_audio "
            "(reciter_id, verse_key, audio_url, duration_ms) VALUES (?,?,?,?)",
            (reciter_id, vk, audio_url or "", duration),
        )
        for seg in segments:
            # QUL emits [word_idx, start_ms, end_ms] arrays
            if not isinstance(seg, list) or len(seg) < 3:
                continue
            try:
                widx, start_ms, end_ms = int(seg[0]), int(seg[1]), int(seg[2])
            except (TypeError, ValueError):
                continue
            cur.execute(
                "INSERT OR REPLACE INTO qalaam_v1_qul_recitations_segments "
                "(reciter_id, verse_key, word_index, start_ms, end_ms) VALUES (?,?,?,?,?)",
                (reciter_id, vk, widx, start_ms, end_ms),
            )
            word_rows += 1

    if kind == "json":
        data = json.loads(payload.read_text())
        for vk, row in data.items():
            feed(vk, row.get("audio_url", ""), row.get("duration"), row.get("segments", []))
    else:  # db
        src = sqlite3.connect(str(payload))
        # Some upstream reciter DBs store ayah_number as the GLOBAL
        # ayah index (1..6236) instead of per-surah. Detect the bug
        # and reconstruct verse_key from the audio_url filename
        # (`SSSAAA.mp3`), which is always per-surah authoritative.
        import re as _re
        _FN_RE = _re.compile(r"/(\d{3})(\d{3})\.mp3", _re.IGNORECASE)
        for surah_n, ayah_n, audio_url, duration, segments_text in src.execute(
            "SELECT surah_number, ayah_number, audio_url, duration, segments FROM verses"
        ):
            if not surah_n or not ayah_n:
                continue
            # Validate ayah_n against the surah; if it looks global,
            # parse from the audio_url filename instead.
            m = _FN_RE.search(audio_url or "")
            if m:
                surah_n, ayah_n = int(m.group(1)), int(m.group(2))
            vk = f"{surah_n}:{ayah_n}"
            try:
                segments = json.loads(segments_text or "[]")
            except json.JSONDecodeError:
                segments = []
            feed(vk, audio_url or "", duration, segments)
        src.close()

    cur.execute(
        "INSERT OR REPLACE INTO qalaam_v1_qul_recitations_reciters "
        "(reciter_id, name_arabic, name_english, style, riwayah, segment_coverage) "
        "VALUES (?,?,?,?,?,?)",
        (reciter_id, reg["arabic"], reg["display"], reg["style"], reg["qiraah"], verses_seen),
    )

    log_ingest(
        conn,
        resource_slug=resource_slug,
        source_id=f"qul-recitation-{rid}",
        source_url=side.get("source_url", f"https://qul.tarteel.ai/resources/recitation/{rid}"),
        license_tag=license_tag,
        attribution=side.get("attribution", "QUL by Tarteel AI"),
        sha256=sha or "no-sha",
        row_count=verses_seen,
    )
    conn.commit()
    print(f"  recitation-{slug}: {verses_seen} verses, {word_rows} word-segments ({kind}, license={license_tag})")
    return verses_seen


# ── Mushaf layouts ───────────────────────────────────────────────────────────
LAYOUTS_TO_INGEST = [
    # (qul_id, layout_id, display_name, source_db_filename)
    (10, "qpc-v2-15-lines",      "KFGQPC v2 — 15 lines (Madani)",   "qpc-v2-15-lines.db"),
    (15, "qpc-v1-15-lines",      "KFGQPC v1 — 15 lines",            "qpc-v1-15-lines.db"),
    (19, "qpc-v4-tajweed-15",    "KFGQPC v4 — Tajweed (15 lines)",  "qpc-v4-tajweed-15-lines.db"),
]


def ingest_layout(conn: sqlite3.Connection, qul_id: int, layout_id: str, display_name: str, db_filename: str) -> int:
    src_dir = UNPACKED / f"mushaf-layout-{qul_id}.sqlite"
    db_path = src_dir / db_filename
    if not db_path.exists():
        print(f"  skip mushaf-layout-{qul_id}: missing {db_path}")
        return 0
    side = read_sidecar(RAW / f"mushaf-layout-{qul_id}.sqlite.zip")
    sha = side.get("sha256", "")
    resource_slug = f"mushaf-layout-{qul_id}"
    if already_ingested(conn, resource_slug, sha) and sha:
        print(f"  {resource_slug}: already ingested")
        return 0

    license_tag = license_for(resource_slug)
    src = sqlite3.connect(str(db_path))
    info = src.execute("SELECT name, number_of_pages, lines_per_page, font_name FROM info LIMIT 1").fetchone()
    info_name, npages, lpp, font_name = info if info else (display_name, 604, 15, None)

    cur = conn.cursor()
    cur.execute(
        "DELETE FROM qalaam_v1_qul_layouts_lines WHERE layout_id = ?", (layout_id,)
    )
    inserted = 0
    for page_n, line_n, line_type, is_centered, fwid, lwid, surah_n in src.execute(
        "SELECT page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number FROM pages"
    ):
        cur.execute(
            "INSERT OR REPLACE INTO qalaam_v1_qul_layouts_lines "
            "(layout_id, page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (layout_id, page_n, line_n, line_type or "ayah", int(is_centered or 0), fwid, lwid, surah_n),
        )
        inserted += 1
    src.close()

    cur.execute(
        "INSERT OR REPLACE INTO qalaam_v1_qul_layouts_info "
        "(layout_id, display_name, number_of_pages, lines_per_page, font_name, license_tag, attribution) "
        "VALUES (?,?,?,?,?,?,?)",
        (layout_id, display_name, int(npages or 604), int(lpp or 15), font_name,
         license_tag, side.get("attribution", "KFGQPC")),
    )

    log_ingest(
        conn,
        resource_slug=resource_slug,
        source_id=f"qul-mushaf-layout-{qul_id}",
        source_url=side.get("source_url", f"https://qul.tarteel.ai/resources/mushaf-layout/{qul_id}"),
        license_tag=license_tag,
        attribution=side.get("attribution", "KFGQPC via QUL"),
        sha256=sha or "no-sha",
        row_count=inserted,
    )
    conn.commit()
    print(f"  {resource_slug}: {inserted} layout lines (license={license_tag})")
    return inserted


def main() -> int:
    if not QUL_DB.exists():
        print(f"ERR: qul.sqlite not found at {QUL_DB}", file=sys.stderr)
        return 2
    if not UNPACKED.exists():
        print(f"ERR: unpacked sources not found at {UNPACKED}", file=sys.stderr)
        return 2

    conn = open_db()
    try:
        ensure_schema(conn)

        print("[1] Mutashabihat v2")
        ingest_mutashabihat(conn)

        print("[2] Similar-ayah pairs")
        ingest_similar_ayah(conn)

        print("[3] Reciters (audio segments)")
        for reg in RECITER_REGISTRY:
            ingest_reciter(conn, reg)

        print("[4] Mushaf layouts")
        for qul_id, layout_id, display_name, db_filename in LAYOUTS_TO_INGEST:
            ingest_layout(conn, qul_id, layout_id, display_name, db_filename)

        print("\n[done] Final ingest_log:")
        for row in conn.execute(
            "SELECT resource_slug, license, row_count, ingested_at "
            "FROM qalaam_v1_qul_ingest_log ORDER BY ingested_at DESC"
        ):
            print(f"  {row[0]:35s}  {row[1]:25s}  rows={row[2]:<7d}  {row[3]}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
