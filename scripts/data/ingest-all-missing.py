#!/usr/bin/env python3
"""
Comprehensive QUL ingest: pull all missing scripts, surah-info languages,
tafsirs, and similar-ayahs into the canonical backend tables.

What we're filling in (per audit):
  1. Scripts beyond uthmani_simple — uthmani (full), qpc-v4 (PUA glyphs),
     indopak-nastaleeq, imlaei-simple
  2. Surah info beyond English — Tamil, Urdu, Malayalam (from existing
     local files; mislabeled folders so we stitch them by inspection)
  3. Tafsir beyond Muyassar — Ibn Kathir (ar-tafsir-ibn-kathir)
  4. Similar-ayah matching pairs (additional to mutashabihat clusters)
"""
from __future__ import annotations
import csv, json, sqlite3, sys
from pathlib import Path

REPO = Path("/home/onnyx/qalam")
DB = REPO / "data/qul.sqlite"
SRC = REPO / "data/qul-source/raw/unpacked"

def pivot(label, fn):
    print(f"\n[{label}]")
    try:
        return fn()
    except Exception as e:
        print(f"  ERR: {e}")
        return 0

def ingest_uthmani_full(conn):
    """Add 'uthmani' rows to qalaam_v1_qul_scripts_words alongside uthmani_simple."""
    src_path = SRC / "quran-script-uthmani.json/uthmani.json"
    with src_path.open() as f:
        data = json.load(f)
    # Each entry: {"id":N, "surah":"S", "ayah":"A", "word":"W", "location":"S:A:W", "text":"..."}
    rows = []
    for v in data.values():
        verse_key = f"{v['surah']}:{v['ayah']}"
        # 0-indexed to match our existing scheme
        word_index = int(v["word"]) - 1
        rows.append(("uthmani", verse_key, word_index, v["text"]))
    # Drop existing uthmani rows then re-insert
    conn.execute("DELETE FROM qalaam_v1_qul_scripts_words WHERE script='uthmani'")
    conn.executemany(
        "INSERT INTO qalaam_v1_qul_scripts_words (script, verse_key, word_index, text) VALUES (?,?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)

def ingest_qpc_v4(conn):
    """v4 tajweed PUA glyph codes."""
    src_path = SRC / "quran-script-v4-tajweed.json/qpc-v4.db"
    src = sqlite3.connect(str(src_path))
    rows = []
    for r in src.execute("SELECT location, text FROM words"):
        loc = r[0]
        parts = loc.split(":")
        if len(parts) != 3: continue
        verse_key = f"{parts[0]}:{parts[1]}"
        word_index = int(parts[2]) - 1
        rows.append(("qpc_v4_tajweed", verse_key, word_index, r[1]))
    src.close()
    conn.execute("DELETE FROM qalaam_v1_qul_scripts_words WHERE script='qpc_v4_tajweed'")
    conn.executemany(
        "INSERT INTO qalaam_v1_qul_scripts_words (script, verse_key, word_index, text) VALUES (?,?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)

def ingest_indopak_nastaleeq(conn):
    """Indo-Pak Nastaleeq script."""
    src_path = SRC / "quran-script-indopak-nastaleeq.json/indopak-nastaleeq.db"
    src = sqlite3.connect(str(src_path))
    rows = []
    for r in src.execute("SELECT location, text FROM words"):
        loc = r[0]
        parts = loc.split(":")
        if len(parts) != 3: continue
        verse_key = f"{parts[0]}:{parts[1]}"
        word_index = int(parts[2]) - 1
        rows.append(("indopak_nastaleeq", verse_key, word_index, r[1]))
    src.close()
    conn.execute("DELETE FROM qalaam_v1_qul_scripts_words WHERE script='indopak_nastaleeq'")
    conn.executemany(
        "INSERT INTO qalaam_v1_qul_scripts_words (script, verse_key, word_index, text) VALUES (?,?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)

def ingest_imlaei(conn):
    """Imlaei simple — verse-level (not word-level), so insert into scripts_ayahs."""
    src_path = SRC / "imlaei-simple.db"
    src = sqlite3.connect(str(src_path))
    rows = []
    for r in src.execute("SELECT verse_key, text FROM verses"):
        rows.append(("imlaei_simple", r[0], r[1]))
    src.close()
    conn.execute("DELETE FROM qalaam_v1_qul_scripts_ayahs WHERE script='imlaei_simple'")
    conn.executemany(
        "INSERT INTO qalaam_v1_qul_scripts_ayahs (script, verse_key, text) VALUES (?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)

def ingest_surah_info_more(conn):
    """Pull Tamil, Malayalam, Urdu, Arabic surah info from local files."""
    inserted = 0
    # Tamil
    ta_path = SRC / "surah-info-ta.json"
    if ta_path.exists():
        with ta_path.open() as f:
            ta = json.load(f)
        for k, v in ta.items():
            n = int(v["surah_number"])
            conn.execute(
                """INSERT OR REPLACE INTO qalaam_v1_qul_surah_info
                   (surah, language_code, name_arabic, name_translated, name_meaning,
                    revelation_place, revelation_order, verse_count, summary, themes_json, asbab_al_nuzul)
                   SELECT surah, 'ta', name_arabic, name_translated, name_meaning,
                          revelation_place, revelation_order, verse_count, ?, themes_json, asbab_al_nuzul
                   FROM qalaam_v1_qul_surah_info WHERE surah=? AND language_code='en'""",
                (v["text"], n),
            )
            inserted += 1
    # Malayalam
    ml_path = SRC / "mushaf-layout-7.sqlite/surah-info-ml.csv"
    if ml_path.exists():
        with ml_path.open() as f:
            for row in csv.DictReader(f):
                n = int(row["surah_number"])
                conn.execute(
                    """INSERT OR REPLACE INTO qalaam_v1_qul_surah_info
                       (surah, language_code, name_arabic, name_translated, name_meaning,
                        revelation_place, revelation_order, verse_count, summary, themes_json, asbab_al_nuzul)
                       SELECT surah, 'ml', name_arabic, name_translated, name_meaning,
                              revelation_place, revelation_order, verse_count, ?, themes_json, asbab_al_nuzul
                       FROM qalaam_v1_qul_surah_info WHERE surah=? AND language_code='en'""",
                    (row["text"], n),
                )
                inserted += 1
    # Urdu (sqlite)
    ur_path = SRC / "mushaf-layout-4.sqlite/surah-info-ur.db"
    if ur_path.exists():
        try:
            us = sqlite3.connect(str(ur_path))
            tbl = us.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").fetchone()
            if tbl:
                cols = [c[1] for c in us.execute(f"PRAGMA table_info({tbl[0]})")]
                # Common pattern: surah_number / surah / id  + text
                snum_col = next((c for c in cols if c in ("surah_number","surah","id")), cols[0])
                text_col = next((c for c in cols if "text" in c.lower() or "info" in c.lower() or "content" in c.lower()), cols[-1])
                for r in us.execute(f"SELECT {snum_col}, {text_col} FROM {tbl[0]}"):
                    n, txt = r
                    if not n or not txt: continue
                    conn.execute(
                        """INSERT OR REPLACE INTO qalaam_v1_qul_surah_info
                           (surah, language_code, name_arabic, name_translated, name_meaning,
                            revelation_place, revelation_order, verse_count, summary, themes_json, asbab_al_nuzul)
                           SELECT surah, 'ur', name_arabic, name_translated, name_meaning,
                                  revelation_place, revelation_order, verse_count, ?, themes_json, asbab_al_nuzul
                           FROM qalaam_v1_qul_surah_info WHERE surah=? AND language_code='en'""",
                        (txt, int(n)),
                    )
                    inserted += 1
            us.close()
        except Exception as e:
            print(f"  ur sub-error: {e}")
    conn.commit()
    return inserted

def ingest_ibn_kathir(conn):
    """Ibn Kathir Arabic tafsir."""
    src_path = SRC / "mushaf-layout-indopak-15.sqlite/ar-tafsir-ibn-kathir.json"
    if not src_path.exists():
        return 0
    with src_path.open() as f:
        data = json.load(f)
    # Register meta
    # qalaam_v1_tafsir_meta uses 'language' not 'language_code', plus
    # verse_count + ingested_at NOT NULL.
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = []
    for verse_key, v in data.items():
        text = v.get("text", "") if isinstance(v, dict) else v
        if text:
            rows.append(("ibn-kathir", verse_key, text))
    conn.execute(
        """INSERT OR REPLACE INTO qalaam_v1_tafsir_meta
           (slug, name, scholar, language, license_tag, attribution, verse_count, ingested_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        ("ibn-kathir", "Tafsir Ibn Kathir", "Ibn Kathir (Ismāʿīl ibn ʿUmar)", "ar",
         "public-domain", "Tafsir Ibn Kathir (ar) via QUL", len(rows), now),
    )
    conn.execute("DELETE FROM qalaam_v1_tafsirs WHERE slug='ibn-kathir'")
    conn.executemany(
        "INSERT INTO qalaam_v1_tafsirs (slug, verse_key, text) VALUES (?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)

def ingest_similar_ayah(conn):
    """Similar-ayah matching pairs (in addition to mutashabihat v2 clusters)."""
    src_path = SRC / "similar-ayah.json/matching-ayah.db"
    if not src_path.exists():
        return 0
    src = sqlite3.connect(str(src_path))
    tbl = src.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").fetchone()
    if not tbl:
        src.close()
        return 0
    table = tbl[0]
    cols = [c[1] for c in src.execute(f"PRAGMA table_info({table})")]
    print(f"  similar-ayah table='{table}' cols={cols}")
    # Stage into dedicated table — keep clean separation from v2 clusters.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_similar_ayahs (
            verse_key TEXT NOT NULL,
            matched_verse_key TEXT NOT NULL,
            score REAL,
            metadata TEXT,
            PRIMARY KEY (verse_key, matched_verse_key)
        )
    """)
    conn.execute("DELETE FROM qalaam_v1_qul_similar_ayahs")
    inserted = 0
    for r in src.execute(f"SELECT * FROM {table}"):
        rec = dict(zip(cols, r))
        # Try common shapes
        vk = rec.get("verse_key") or rec.get("source") or rec.get("ayah_key")
        mvk = rec.get("matched_verse_key") or rec.get("target") or rec.get("matched_ayah_key") or rec.get("similar_to")
        score = rec.get("score") or rec.get("similarity")
        if not vk or not mvk: continue
        meta = json.dumps({k: v for k, v in rec.items() if k not in ("verse_key","matched_verse_key","source","target","score")})
        try:
            conn.execute(
                "INSERT OR REPLACE INTO qalaam_v1_qul_similar_ayahs (verse_key, matched_verse_key, score, metadata) VALUES (?,?,?,?)",
                (str(vk), str(mvk), float(score) if score else None, meta),
            )
            inserted += 1
        except Exception:
            pass
    src.close()
    conn.commit()
    return inserted

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr)
        return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")

    pivot("uthmani full",     lambda: print(f"  inserted {ingest_uthmani_full(conn)} rows") or 1)
    pivot("qpc-v4 PUA glyphs", lambda: print(f"  inserted {ingest_qpc_v4(conn)} rows") or 1)
    pivot("indopak-nastaleeq", lambda: print(f"  inserted {ingest_indopak_nastaleeq(conn)} rows") or 1)
    pivot("imlaei-simple (ayah-level)", lambda: print(f"  inserted {ingest_imlaei(conn)} rows") or 1)
    pivot("surah-info ta/ml/ur", lambda: print(f"  inserted {ingest_surah_info_more(conn)} rows") or 1)
    pivot("Ibn Kathir tafsir", lambda: print(f"  inserted {ingest_ibn_kathir(conn)} rows") or 1)
    pivot("similar-ayah pairs", lambda: print(f"  inserted {ingest_similar_ayah(conn)} rows") or 1)

    print("\n[final state of qalaam_v1_qul_scripts_words]")
    for r in conn.execute("SELECT script, COUNT(*) FROM qalaam_v1_qul_scripts_words GROUP BY script"):
        print(f"  {r[0]:25s} {r[1]}")
    print("\n[final state of qalaam_v1_qul_surah_info]")
    for r in conn.execute("SELECT language_code, COUNT(*) FROM qalaam_v1_qul_surah_info GROUP BY language_code"):
        print(f"  {r[0]:5s} {r[1]}")
    print("\n[final state of qalaam_v1_tafsir_meta]")
    for r in conn.execute("SELECT slug, name, scholar, language_code FROM qalaam_v1_tafsir_meta"):
        print(f"  {r}")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
