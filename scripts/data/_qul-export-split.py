#!/usr/bin/env python3
# ruff: noqa: PERF401, PLR2004, PLR0912, PLR0915
"""Split the raw QUL export JSON into per-resource files matching the
shapes our ingest scripts expect.

The bootstrap pipeline produces `data/qul-source/_raw-export.json` from
the throwaway Postgres; this script slices that document into:

    data/qul-source/quran-metadata.json
    data/qul-source/mutashabihat-v2.json
    data/qul-source/wbw-translations-en.json

The shapes here mirror exactly what `scripts/data/ingest-qul-*.ts`
expect so a re-run of the ingest scripts populates `data/qul.sqlite`
without further glue.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def split(raw_path: Path, out_dir: Path) -> None:
    text = raw_path.read_text("utf-8").lstrip()
    # psql may echo `SET` and other DDL acknowledgments before the JSON
    # value when running `-f file.sql`. Find the first `{` and parse from
    # there.
    if not text.startswith("{") and not text.startswith("["):
        idx = text.find("{")
        if idx == -1:
            raise SystemExit(f"no JSON object found in {raw_path}")
        text = text[idx:]
    raw = json.loads(text)
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        raw = raw[0]
    if not isinstance(raw, dict):
        raise SystemExit(f"unexpected raw shape: {type(raw)}")

    chapters = raw.get("chapters") or []
    juzs = raw.get("juzs") or []
    hizbs = raw.get("hizbs") or []
    rub_el_hizbs = raw.get("rub_el_hizbs") or []
    manzils = raw.get("manzils") or []
    rukus = raw.get("rukus") or []
    sajda_verses = raw.get("sajda_verses") or []
    verse_keys: dict[str, str] = raw.get("verses_keys") or {}
    verses_basic = raw.get("verses_basic") or []
    mut_phrases = raw.get("mutashabihat_phrases") or []
    sim_pairs = raw.get("similar_ayah_pairs") or []
    wbw = raw.get("wbw_translations") or []

    # quran-metadata.json — the shape ingest-qul-metadata.ts expects.
    surahs = []
    for c in chapters:
        surahs.append(
            {
                "surah": c["surah"],
                "name_arabic": c.get("name_arabic") or c.get("name_simple") or str(c["surah"]),
                "name_transliteration": c.get("name_simple")
                or c.get("name_arabic")
                or str(c["surah"]),
                "name_english": c.get("name_complex") or c.get("name_simple") or str(c["surah"]),
                "verse_count": c.get("verses_count", 0),
                "revelation_place": (c.get("revelation_place") or "makkah").lower(),
                "revelation_order": c.get("revelation_order", c["surah"]),
                "bismillah_pre": bool(c.get("bismillah_pre", True)),
            }
        )
    juz_records = []
    for j in juzs:
        first = verse_keys.get(str(j.get("first_verse_id", "")), "")
        last = verse_keys.get(str(j.get("last_verse_id", "")), "")
        juz_records.append(
            {
                "juz": j["juz"],
                "first_verse_key": first,
                "last_verse_key": last,
                "verse_count": j.get("verses_count", 0),
            }
        )

    def _vk(vid: Any) -> str:
        return verse_keys.get(str(vid), "")

    # Map each verse_key to its metadata so we can synthesize a chapter→ruku
    # lookup the ingest script wants.
    chapter_by_verse: dict[str, int] = {}
    for v in verses_basic:
        chapter_by_verse[v.get("verse_key", "")] = v.get("chapter_id", 0)

    hizb_records = [
        {
            "hizb": h["hizb"],
            "juz": ((h["hizb"] - 1) // 2) + 1,
            "first_verse_key": _vk(h.get("first_verse_id")),
            "last_verse_key": _vk(h.get("last_verse_id")),
        }
        for h in hizbs
    ]
    rub_records = [
        {
            "rub": r["rub"],
            "hizb": ((r["rub"] - 1) // 4) + 1,
            "first_verse_key": _vk(r.get("first_verse_id")),
        }
        for r in rub_el_hizbs
    ]
    manzil_records = [
        {
            "manzil": m["manzil"],
            "first_verse_key": _vk(m.get("first_verse_id")),
            "last_verse_key": _vk(m.get("last_verse_id")),
        }
        for m in manzils
    ]
    ruku_records = []
    for rk in rukus:
        first_vk = _vk(rk.get("first_verse_id"))
        last_vk = _vk(rk.get("last_verse_id"))
        surah = chapter_by_verse.get(first_vk, 0)
        ruku_records.append(
            {
                "ruku": rk["ruku"],
                "surah": surah,
                "first_verse_key": first_vk,
                "last_verse_key": last_vk,
            }
        )
    # Sajda type field uses 'recommended' / 'obligatory' values per the ingest
    # script's CHECK constraint; QUL stores 'recommended'/'obligatory'/etc.
    # Coerce anything we don't recognize to 'recommended'.
    allowed_sajda = {"recommended", "obligatory"}
    sajda_records = []
    for s in sajda_verses:
        t = (s.get("type") or "recommended").lower()
        if t not in allowed_sajda:
            t = "recommended"
        sajda_records.append({"verse_key": s["verse_key"], "type": t})

    metadata = {
        "surahs": surahs,
        "juz": juz_records,
        "hizb": hizb_records,
        "rub": rub_records,
        "manzil": manzil_records,
        "ruku": ruku_records,
        "sajda": sajda_records,
    }
    (out_dir / "quran-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        "utf-8",
    )

    # mutashabihat-v2.json — clusters + pairs.
    cluster_payload: list[dict[str, Any]] = []
    by_match: dict[Any, list[Any]] = {}
    for row in mut_phrases:
        # QUL groups phrases by `matched_with_id` (the canonical phrase
        # they all match). Build clusters from that grouping.
        anchor = row.get("matched_with_id") or row.get("id")
        by_match.setdefault(anchor, []).append(row)
    for anchor, members in by_match.items():
        if not members:
            continue
        member_keys = []
        for m in members:
            v_id = m.get("verse_id")
            vk = verse_keys.get(str(v_id))
            if vk:
                member_keys.append(vk)
        if not member_keys:
            continue
        first = members[0]
        cluster_payload.append(
            {
                "cluster_id": f"qul-mut-{anchor}",
                "shared_phrase": first.get("matched_text") or "",
                "member_verse_keys": sorted(set(member_keys)),
            }
        )

    pair_payload: list[dict[str, Any]] = []
    for p in sim_pairs:
        left = verse_keys.get(str(p.get("ayah_id")))
        right = verse_keys.get(str(p.get("similar_ayah_id")))
        if not left or not right:
            continue
        score = p.get("score")
        try:
            score_num = float(score) if score is not None else 0.5
        except (TypeError, ValueError):
            score_num = 0.5
        pair_payload.append(
            {
                "left_verse_key": left,
                "right_verse_key": right,
                "score": max(0.0, min(1.0, score_num)),
                "note": p.get("color"),
            }
        )
    (out_dir / "mutashabihat-v2.json").write_text(
        json.dumps(
            {"clusters": cluster_payload, "pairs": pair_payload},
            ensure_ascii=False,
            indent=2,
        ),
        "utf-8",
    )

    # wbw-translations-en.json
    wbw_records = []
    for w in wbw:
        v_id = w.get("verse_id")
        vk = verse_keys.get(str(v_id))
        if not vk:
            continue
        wbw_records.append(
            {
                "verse_key": vk,
                "word_index": (w.get("position") or 1) - 1,
                "text_arabic": w.get("text_uthmani") or w.get("text_imlaei") or "",
                "translation": w.get("en_translation") or "",
                "language_code": "en",
            }
        )
    (out_dir / "wbw-translations-en.json").write_text(
        json.dumps({"words": wbw_records}, ensure_ascii=False, indent=2),
        "utf-8",
    )

    print(
        f"split: surahs={len(surahs)}, juz={len(juz_records)}, "
        f"clusters={len(cluster_payload)}, pairs={len(pair_payload)}, "
        f"wbw={len(wbw_records)}"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: _qul-export-split.py <raw.json> <out_dir>")
    split(Path(sys.argv[1]), Path(sys.argv[2]))
