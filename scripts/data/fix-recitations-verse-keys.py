#!/usr/bin/env python3
"""
Fix verse_key in qalaam_v1_qul_recitations_audio + segments tables for
reciters whose source DB stored ayah_number as the GLOBAL ayah index
(1..6236) instead of per-surah index. Affects:
  abdul-basit-mujawwad, abdul-basit-murattal, hani-rifai, saud-shuraim,
  yasser-aldosari (and any future reciter with the same upstream shape).

Strategy:
  Audio rows store the canonical audio_url which always encodes the
  filename `SSSAAA.mp3` (e.g. 100001.mp3 = surah 100 ayah 1). We
  reconstruct verse_key from that filename.

  Segments rows DON'T have the audio_url, so we rebuild verse_key
  using a global-to-per-surah mapping derived from the metadata
  surah-verse-counts.
"""
from __future__ import annotations
import re, sqlite3, sys
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
FILENAME_RE = re.compile(r"/(\d{3})(\d{3})\.mp3", re.IGNORECASE)

def parse_audio_filename(audio_url: str) -> tuple[int, int] | None:
    m = FILENAME_RE.search(audio_url or "")
    if not m: return None
    return (int(m.group(1)), int(m.group(2)))

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr); return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")

    # 1. Build the global-ayah → (surah, ayah) map from surah metadata.
    rows = conn.execute(
        "SELECT surah, verse_count FROM qalaam_v1_qul_metadata_surahs ORDER BY surah"
    ).fetchall()
    global_to_per_surah: dict[int, tuple[int, int]] = {}
    g = 1
    for surah, vc in rows:
        for a in range(1, vc + 1):
            global_to_per_surah[g] = (surah, a)
            g += 1
    print(f"global-ayah map: {len(global_to_per_surah)} entries (1..{g-1})")

    # 2. For each reciter, check whether MIN(SUBSTR(verse_key, INSTR+1)) > 999.
    # That's a heuristic — surah 9 has 129 ayahs, so a per-surah ayah
    # would never exceed ~286 (surah 2). If we see ayahs > 1000 the
    # data is global-style.
    bad_reciters: list[str] = []
    for rid, max_ayah in conn.execute("""
        SELECT reciter_id,
               MAX(CAST(SUBSTR(verse_key, INSTR(verse_key, ':')+1) AS INTEGER))
        FROM qalaam_v1_qul_recitations_audio
        GROUP BY reciter_id
    """):
        if max_ayah and max_ayah > 1000:
            bad_reciters.append(rid)
    print(f"reciters with global-style ayah_numbers: {bad_reciters}")

    if not bad_reciters:
        print("nothing to fix")
        return 0

    fixed_audio = 0
    fixed_segs = 0

    for rid in bad_reciters:
        # Build a row-by-row mapping of OLD verse_key → NEW verse_key.
        rekey: dict[str, str] = {}
        for old_vk, audio_url in conn.execute(
            "SELECT verse_key, audio_url FROM qalaam_v1_qul_recitations_audio WHERE reciter_id = ?",
            (rid,),
        ):
            # Try filename parse first (most reliable).
            parsed = parse_audio_filename(audio_url or "")
            if parsed:
                rekey[old_vk] = f"{parsed[0]}:{parsed[1]}"
                continue
            # Fallback: parse OLD verse_key, treat ayah part as global.
            try:
                _, ayah_part = old_vk.split(":", 1)
                g_idx = int(ayah_part)
                if g_idx in global_to_per_surah:
                    s, a = global_to_per_surah[g_idx]
                    rekey[old_vk] = f"{s}:{a}"
            except (ValueError, KeyError):
                pass

        print(f"  {rid}: {len(rekey)} rows to remap")
        if not rekey:
            continue

        # Rewrite audio_url table — delete+insert rather than UPDATE
        # (avoids primary-key conflicts when keys collide).
        cur = conn.cursor()
        rows_audio = cur.execute(
            "SELECT verse_key, audio_url, duration_ms FROM qalaam_v1_qul_recitations_audio WHERE reciter_id = ?",
            (rid,),
        ).fetchall()
        cur.execute("DELETE FROM qalaam_v1_qul_recitations_audio WHERE reciter_id = ?", (rid,))
        for old_vk, audio_url, dur in rows_audio:
            new_vk = rekey.get(old_vk, old_vk)
            cur.execute(
                "INSERT INTO qalaam_v1_qul_recitations_audio (reciter_id, verse_key, audio_url, duration_ms) VALUES (?,?,?,?)",
                (rid, new_vk, audio_url, dur),
            )
            fixed_audio += 1

        # Rewrite segments table similarly.
        rows_seg = cur.execute(
            "SELECT verse_key, word_index, start_ms, end_ms FROM qalaam_v1_qul_recitations_segments WHERE reciter_id = ?",
            (rid,),
        ).fetchall()
        cur.execute("DELETE FROM qalaam_v1_qul_recitations_segments WHERE reciter_id = ?", (rid,))
        for old_vk, widx, sm, em in rows_seg:
            new_vk = rekey.get(old_vk, old_vk)
            cur.execute(
                "INSERT OR REPLACE INTO qalaam_v1_qul_recitations_segments (reciter_id, verse_key, word_index, start_ms, end_ms) VALUES (?,?,?,?,?)",
                (rid, new_vk, widx, sm, em),
            )
            fixed_segs += 1

    conn.commit()
    print(f"\ndone: audio={fixed_audio} segments={fixed_segs}")

    # Verify
    print("\nverification — verse_key range per reciter:")
    for rid, mn, mx in conn.execute("""
        SELECT reciter_id,
               MIN(verse_key), MAX(verse_key)
        FROM qalaam_v1_qul_recitations_audio
        GROUP BY reciter_id
        ORDER BY reciter_id
    """):
        print(f"  {rid:25s}  min={mn:9s}  max={mx}")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
