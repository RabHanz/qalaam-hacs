#!/usr/bin/env python3
"""
Deep-pull reciters from EveryAyah (free public CDN) — 60+ reciters
with full 6,236-verse coverage. URL pattern:
  https://everyayah.com/data/<subfolder>/<surah:03d><ayah:03d>.mp3

The catalog at https://everyayah.com/data/recitations.js maps numeric
ID → { subfolder, name, bitrate }. We:
1. Pick high-quality reciters not already in our DB.
2. For each, generate 6,236 audio_url rows (verse-by-verse).
3. Insert into qalaam_v1_qul_recitations_audio +
   qalaam_v1_qul_recitations_reciters.

License: per-reciter via EveryAyah aggregator. Attribution: original
reciter + everyayah.com. License-tag = 'per-reciter'.

Segments: NOT pulled here — most EveryAyah reciters lack word-level
timing. The 14 already-ingested reciters (with 1.08M segments) keep
their segment coverage; new reciters get audio-only.
"""
from __future__ import annotations
import json, sqlite3, sys, time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
EVERYAYAH = "https://everyayah.com/data"
CATALOG = "https://everyayah.com/data/recitations.js"

# Curated picks — top reciters with full coverage. Skip duplicates of
# reciters we already have segmented audio for (they keep their better
# version). Prefer 64kbps or 128kbps mid-quality for size/quality
# balance.
PICKS = [
    # (catalog_id, our_slug, name_en, name_ar, style, riwayah)
    # Note: numeric ids change between EveryAyah revisions — we match by
    # subfolder name when ingesting to be resilient.
    ("Abdullah_Basfar_64kbps",                   "abdullah-basfar",        "Abdullah Basfar",        "عبد الله بصفر",                  "murattal", "hafs"),
    ("Ahmed_Neana_128kbps",                      "ahmed-neana",            "Ahmed Neana",            "أحمد نعينع",                     "murattal", "hafs"),
    ("Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com", "ahmed-al-ajami","Ahmed al-Ajami",          "أحمد بن علي العجمي",             "murattal", "hafs"),
    ("Akram_AlAlaqimy_128kbps",                  "akram-al-alaqimy",       "Akram al-ʿAlaqimy",      "أكرم العلاقمي",                 "murattal", "hafs"),
    ("Alafasy_64kbps",                            "alafasy-64",             "Mishary al-Afasy 64k",    "مشاري العفاسي",                  "murattal", "hafs"),
    ("Ali_Hajjaj_AlSuesy_128kbps",               "ali-hajjaj-suesy",       "Ali Hajjaj al-Suesy",    "علي حجاج السويسي",                "murattal", "hafs"),
    ("Ali_Jaber_64kbps",                          "ali-jaber",              "ʿAli Jaber",             "علي جابر",                       "murattal", "hafs"),
    ("Ayman_Sowaid_64kbps",                       "ayman-sowaid",           "Ayman Sowaid",           "أيمن سويد",                      "muallim",  "hafs"),
    ("Ghamadi_40kbps",                            "ghamadi-40",             "Saʿd al-Ghamdi 40k",     "سعد الغامدي",                    "murattal", "hafs"),
    ("Hudhaify_64kbps",                           "ali-al-hudhaify",        "ʿAli al-Hudhaify",       "علي الحذيفي",                    "murattal", "hafs"),
    ("Husary_128kbps_Mujawwad",                   "husary-mujawwad-128",    "al-Husary Mujawwad",     "محمود الحصري (مجود)",            "mujawwad", "hafs"),
    ("Husary_128kbps",                            "husary-128",             "al-Husary 128k",         "محمود الحصري",                   "murattal", "hafs"),
    ("Husary_64kbps",                             "husary-64",              "al-Husary 64k",          "محمود الحصري",                   "murattal", "hafs"),
    ("Hudhaify_32kbps",                           "hudhaify-32",            "al-Hudhaify 32k",        "علي الحذيفي",                    "murattal", "hafs"),
    ("Ibrahim_Akhdar_32kbps",                     "ibrahim-al-akhdar",      "Ibrāhīm al-Akhdar",      "إبراهيم الأخضر",                 "murattal", "hafs"),
    ("Khalifa_Al_Tunaiji_64kbps",                 "khalifa-tunaiji-64",     "Khalifa al-Tunaiji 64k", "خليفة التنيجي",                  "murattal", "hafs"),
    ("Maher_AlMuaiqly_64kbps",                    "maher-muaiqly-64",       "Maher al-Muaiqly 64k",   "ماهر المعيقلي",                  "murattal", "hafs"),
    ("Menshawi_Mujawwad_192kbps",                 "minshawi-mujawwad-192",  "al-Minshawi Mujawwad",   "محمد صديق المنشاوي (مجود)",      "mujawwad", "hafs"),
    ("Mohammad_al_Tablaway_128kbps",              "mohammad-al-tablaway",   "Muhammad al-Tablaway",   "محمد الطبلاوي",                 "murattal", "hafs"),
    ("Muhammad_Ayyoub_128kbps",                   "muhammad-ayyoub",        "Muhammad Ayyoub",        "محمد أيوب",                     "murattal", "hafs"),
    ("Muhammad_Jibreel_64kbps",                   "muhammad-jibreel",       "Muhammad Jibreel",       "محمد جبريل",                    "murattal", "hafs"),
    ("Muhsin_Al_Qasim_192kbps",                   "muhsin-al-qasim",        "Muhsin al-Qasim",        "محسن القاسم",                   "murattal", "hafs"),
    ("Mustafa_Ismail_48kbps",                     "mustafa-ismail",         "Mustafa Ismail",         "مصطفى إسماعيل",                  "mujawwad", "hafs"),
    ("Nasser_Alqatami_128kbps",                   "nasser-al-qatami",       "Nasser al-Qatami",       "ناصر القطامي",                  "murattal", "hafs"),
    ("Saood_ash-Shuraym_64kbps",                  "saood-shuraym-64",       "Saʿūd al-Shuraym 64k",   "سعود الشريم",                   "murattal", "hafs"),
    ("Salaah_AbdulRahman_Bukhatir_128kbps",       "salah-bukhatir",         "Salah al-Bukhatir",      "صلاح بوخاطر",                   "murattal", "hafs"),
    ("Yasser_Ad-Dussary_128kbps",                 "yasser-dussary-128",     "Yasser al-Dussary 128k", "ياسر الدوسري",                  "murattal", "hafs"),
    ("Hani_Rifai_64kbps",                         "hani-rifai-64",          "Hani al-Rifai 64k",      "هاني الرفاعي",                  "murattal", "hafs"),
    ("Abdullaah_3awwaad_Al-Juhaynee_128kbps",     "abdullah-juhaynee",      "Abdullah al-Juhaynee",   "عبد الله الجهني",               "murattal", "hafs"),
    ("Abdul_Wadood_Haneef_32kbps",                "abdul-wadood-haneef",    "Abdul Wadood Haneef",    "عبد الودود حنيف",               "murattal", "hafs"),
    ("Abu_Bakr_Ash-Shaatree_64kbps",              "abu-bakr-shatri-64",     "Abu Bakr al-Shatri 64k", "أبو بكر الشاطري",                "murattal", "hafs"),
    ("Fares_Abbad_64kbps",                        "fares-abbad",            "Fares Abbad",            "فارس عباد",                     "murattal", "hafs"),
    ("Hudaify_128kbps",                           "hudhaify-128",           "al-Hudhaify 128k",       "علي الحذيفي",                   "murattal", "hafs"),
    ("Ibrahim_Akhdar_64kbps",                     "ibrahim-al-akhdar-64",   "Ibrāhīm al-Akhdar 64k",  "إبراهيم الأخضر",                "murattal", "hafs"),
    ("Karim_Mansoori_40kbps",                     "karim-mansoori",         "Karim Mansoori",         "كريم منصوري",                  "murattal", "hafs"),
    ("Khaalid_Abdullaah_al-Qahtaanee_192kbps",    "khalid-al-qahtani",      "Khalid al-Qahtani",      "خالد القحطاني",                "murattal", "hafs"),
    ("MaherAlMuaiqly128kbps",                     "maher-muaiqly-128",      "Maher al-Muaiqly 128k",  "ماهر المعيقلي",                  "murattal", "hafs"),
    ("Mohammad_al_Tablaway_64kbps",               "mohammad-tablaway-64",   "Muhammad al-Tablaway 64k","محمد الطبلاوي",                "murattal", "hafs"),
    ("Sahl_Yassin_128kbps",                       "sahl-yasin",             "Sahl Yasin",             "سهل ياسين",                     "murattal", "hafs"),
    ("Salah_Al_Budair_128kbps",                   "salah-al-budair",        "Salah al-Budair",        "صلاح البدير",                   "murattal", "hafs"),
    ("Yaser_Salamah_128kbps",                     "yaser-salamah",          "Yaser Salamah",          "ياسر السلامة",                  "murattal", "hafs"),
]

def fetch_catalog() -> dict:
    with urllib.request.urlopen(CATALOG, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing"); return 2
    cat = fetch_catalog()
    ayah_count = cat.get("ayahCount", [])
    if not ayah_count or len(ayah_count) < 114:
        print("ERR: catalog missing ayahCount"); return 1

    # Build subfolder → entry map
    by_subfolder: dict[str, dict] = {}
    for k, v in cat.items():
        if k == "ayahCount" or not isinstance(v, dict):
            continue
        sf = v.get("subfolder")
        if sf:
            by_subfolder[sf] = v

    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    existing = {row[0] for row in conn.execute("SELECT reciter_id FROM qalaam_v1_qul_recitations_reciters")}
    print(f"existing reciters: {len(existing)}")

    pulled = 0
    skipped = 0
    not_found = []

    for subfolder, slug, name_en, name_ar, style, riwayah in PICKS:
        if slug in existing:
            skipped += 1
            continue
        if subfolder not in by_subfolder:
            not_found.append(subfolder)
            continue
        # Generate 6,236 verse → audio URL rows.
        rows_audio = []
        for s_idx, n in enumerate(ayah_count, start=1):
            for a_idx in range(1, n + 1):
                vk = f"{s_idx}:{a_idx}"
                fn = f"{s_idx:03d}{a_idx:03d}.mp3"
                url = f"{EVERYAYAH}/{subfolder}/{fn}"
                rows_audio.append((slug, vk, url, None))
        conn.execute("DELETE FROM qalaam_v1_qul_recitations_audio WHERE reciter_id = ?", (slug,))
        conn.executemany(
            "INSERT INTO qalaam_v1_qul_recitations_audio (reciter_id, verse_key, audio_url, duration_ms) VALUES (?,?,?,?)",
            rows_audio,
        )
        conn.execute(
            """INSERT OR REPLACE INTO qalaam_v1_qul_recitations_reciters
               (reciter_id, name_arabic, name_english, style, riwayah, segment_coverage)
               VALUES (?,?,?,?,?,?)""",
            (slug, name_ar, name_en, style, riwayah, len(rows_audio)),
        )
        conn.commit()
        pulled += 1
        print(f"  ✓ [{pulled}/{len(PICKS)-skipped}] {slug:30s} {name_en} ({len(rows_audio)} rows)")
        time.sleep(0.05)  # tiny pause to be polite

    print()
    print(f"=== Done. pulled={pulled} skipped={skipped} not_found={len(not_found)} ===")
    if not_found:
        print(f"  not in catalog: {not_found[:5]}…")

    print()
    print("=== Final reciter count ===")
    total = conn.execute("SELECT COUNT(*) FROM qalaam_v1_qul_recitations_reciters").fetchone()[0]
    print(f"  TOTAL: {total} reciters")
    print()
    print("=== With segments (word-by-word capable): ===")
    seg_reciters = conn.execute(
        "SELECT COUNT(DISTINCT reciter_id) FROM qalaam_v1_qul_recitations_segments"
    ).fetchone()[0]
    print(f"  {seg_reciters} reciters have word-level segments (Tarteel-style highlight)")
    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
