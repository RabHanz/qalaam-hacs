#!/usr/bin/env python3
"""license-auto-tag.py — classify QUL sidecar .license.json files.

Walks every `data/qul-source/raw/**/*.license.json` produced by
`scrape-qul-full.py` and assigns the most-appropriate `license_tag`
from the canonical set in `packages/data-loader/src/qul/license.ts`:

    public-domain         — pre-1928 originals (Pickthall, Yusuf Ali,
                             Ibn Kathir/Tabari/Qurtubi Arabic originals)
    factual               — verse counts, juz boundaries, surah names,
                             revelation order — all `quran-metadata`
                             plus `surah-info` (which is descriptive
                             metadata, not creative content)
    permissive-with-credit — Mukhtasar series, Saadi multilingual,
                             most modern translations/tafsirs that
                             QUL ships, similar-ayah, mutashabihat,
                             ayah-themes, ayah-topics, transliterations
    kfgqpc-terms          — KFGQPC fonts + scripts + V1/V2/V4 layouts
                             (anything tagged "QPC", "KFGQPC", "Hafs"
                             from the Madani Mushaf project)
    digitalkhatt-anane    — DigitalKhatt fonts + scripts + layout
                             (Dr. Amin Anane attribution required)
    gpl-derivative        — Kais Dukes' Quranic Arabic Corpus
                             morphology (`/resources/morphology/*`)
    per-translator        — anything we can't auto-classify in the
                             translation category — defaults here
                             so the ingest gate forces manual review
    per-reciter           — same default for the recitation category
    unverified            — left in place if no rule matches; the
                             ingest pipeline refuses these

Decision rules (in priority order):
  1. category = quran-metadata  → factual
  2. category = morphology      → gpl-derivative
  3. category = font / quran-script / mushaf-layout
        a. tag/title contains "Digital Khatt" → digitalkhatt-anane
        b. tag/title contains "KFGQPC" / "QPC" / "Hafs" / "Madani" → kfgqpc-terms
        c. otherwise → permissive-with-credit
  4. category = surah-info / similar-ayah / mutashabihat
                / ayah-theme / ayah-topics / transliteration
        → permissive-with-credit
  5. category = recitation
        a. KFGQPC-published Madinah/Makkah Taraweeh → kfgqpc-terms
        b. otherwise → per-reciter (forces manual)
  6. category = translation
        a. Pickthall / Yusuf Ali / Shakir / Sale → public-domain
        b. Sahih International → per-translator (commercial)
        c. otherwise → permissive-with-credit (most modern volunteer)
  7. category = tafsir
        a. Ibn Kathir / Tabari / Qurtubi / Suyuti / Saadi (Arabic
           originals) → public-domain
        b. translations of those → permissive-with-credit
        c. Mukhtasar series → permissive-with-credit
        d. otherwise → permissive-with-credit

Idempotent: re-running won't overwrite a tag that's already been
manually edited away from a default — only those still tagged
`unverified` are mutated.

Usage:
    python3 scripts/data/license-auto-tag.py
    --dry-run        # print classifications, don't write
    --reset          # rewrite even non-unverified tags (use carefully)
"""
# ruff: noqa: PLR0911, PLR0912, PLR0915

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = REPO_ROOT / "data" / "qul-source" / "raw"

logging.basicConfig(format="%(levelname)-7s %(message)s", level=logging.INFO)
log = logging.getLogger("license-auto-tag")

PUBLIC_DOMAIN_TRANSLATORS = {
    "pickthall",
    "yusuf ali",
    "yusufali",
    "shakir",
    "sale",
    "rodwell",
    "palmer",
    "arberry",
    "ahmedraza",
    "ahmed raza",
    "muhsin khan",
    "hilali",
}
COMMERCIAL_TRANSLATORS = {
    "saheeh international",
    "sahih international",
}
PUBLIC_DOMAIN_TAFSIR_AUTHORS_AR = {
    "ibn kathir",
    "tabari",
    "tabri",
    "qurtubi",
    "suyuti",
    "jalalayn",
    "ibn al-jazari",
    "saadi",
    "as-saadi",
    "as saadi",
}


def classify(category: str, title: str, tags_str: str, *, search_kw: str = "") -> str:
    """Return the best-guess license_tag per the decision rules."""
    title_l = title.lower()
    tags_l = tags_str.lower()
    search_l = search_kw.lower()
    haystack = f"{title_l} {tags_l} {search_l}"

    if category == "quran-metadata":
        return "factual"
    if category == "morphology":
        return "gpl-derivative"
    if category in {"font", "quran-script", "mushaf-layout"}:
        if "digital khatt" in haystack or "digitalkhatt" in haystack:
            return "digitalkhatt-anane"
        if any(
            kw in haystack
            for kw in ("kfgqpc", "qpc ", "qpc-", "hafs", "madani", "tajweed", "v4", "v2 ", "v1 ")
        ):
            return "kfgqpc-terms"
        return "permissive-with-credit"
    if category in {
        "surah-info",
        "similar-ayah",
        "mutashabihat",
        "ayah-theme",
        "ayah-topics",
        "transliteration",
    }:
        return "permissive-with-credit"
    if category == "recitation":
        # KFGQPC-published Madinah/Makkah Taraweeh
        if any(kw in haystack for kw in ("madinah taraweeh", "makkah taraweeh")):
            return "kfgqpc-terms"
        return "per-reciter"
    if category == "translation":
        for pd in PUBLIC_DOMAIN_TRANSLATORS:
            if pd in haystack:
                return "public-domain"
        for cm in COMMERCIAL_TRANSLATORS:
            if cm in haystack:
                return "per-translator"
        return "permissive-with-credit"
    if category == "tafsir":
        if any(kw in haystack for kw in PUBLIC_DOMAIN_TAFSIR_AUTHORS_AR) and "arabic" in haystack:
            return "public-domain"
        return "permissive-with-credit"
    return "unverified"


def attribution_text(category: str, title: str) -> str:
    """Build a human-readable attribution string for the sidecar."""
    if category == "morphology":
        return "Quranic Arabic Corpus — Dr. Kais Dukes (et al.)"
    if "kfgqpc" in title.lower() or "qpc" in title.lower() or "hafs" in title.lower():
        return f"{title} — King Fahd Glorious Quran Printing Complex (KFGQPC)"
    if "digital khatt" in title.lower():
        return f"{title} — DigitalKhatt by Dr. Amin Anane"
    return f"{title} (via QUL — Tarteel AI)"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--dry-run", action="store_true", help="print classifications, don't write")
    parser.add_argument(
        "--reset", action="store_true", help="rewrite even non-unverified tags (use carefully)"
    )
    parser.add_argument(
        "--root", type=Path, default=RAW_DIR, help=f"sidecar root directory (default: {RAW_DIR})"
    )
    args = parser.parse_args()

    if not args.root.exists():
        log.error("raw dir missing: %s", args.root)
        sys.exit(2)

    sidecars = list(args.root.rglob("*.license.json"))
    log.info("found %d sidecars under %s", len(sidecars), args.root)

    counts: dict[str, int] = {}
    skipped = 0
    written = 0

    for sidecar in sidecars:
        try:
            payload = json.loads(sidecar.read_text())
        except Exception as e:
            log.warning("skip %s: %s", sidecar, e)
            skipped += 1
            continue

        existing_tag = payload.get("license_tag", "unverified")
        if existing_tag != "unverified" and not args.reset:
            counts[existing_tag] = counts.get(existing_tag, 0) + 1
            continue

        category = payload.get("category", "")
        title = payload.get("title", "")
        tags_str = payload.get("tags", "")
        # Backfill: older sidecars from scrape-qul.sh used `source_id: "qul-<cat>-<id>"`
        # and `source_url: "https://qul.tarteel.ai/resources/<cat>/<id>"` without
        # an explicit `category` field. Recover it from either source.
        if not category:
            sid = payload.get("source_id", "") or ""
            sm = re.match(r"qul-([a-z-]+)-\d+$", sid)
            if sm:
                category = sm.group(1)
            else:
                surl = payload.get("source_url", "") or ""
                cm = re.search(r"/resources/([a-z-]+)/", surl)
                if cm:
                    category = cm.group(1)
        # Backfill title from sidecar filename if missing
        if not title:
            title = sidecar.parent.name + " " + sidecar.name.replace(".license.json", "")
        # search_keywords isn't always present; some sidecars carry license_chip
        search_kw = payload.get("license_chip", "") + " " + payload.get("notes", "")
        new_tag = classify(category, title, tags_str, search_kw=search_kw)

        counts[new_tag] = counts.get(new_tag, 0) + 1

        if args.dry_run:
            log.info(
                "WOULD %-22s ← %s/%-4s  %s", new_tag, category, payload.get("source_id"), title[:50]
            )
            continue

        # Mutate sidecar
        payload["license_tag"] = new_tag
        if not payload.get("attribution_text"):
            payload["attribution_text"] = attribution_text(category, title)
        if "license_classified_at" not in payload:
            payload["license_classified_at"] = datetime.now(UTC).isoformat(
                timespec="seconds"
            )
        payload["license_auto_tagged"] = True
        sidecar.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        written += 1

    log.info("")
    log.info("=== summary ===")
    for tag, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        log.info("  %-22s  %4d", tag, n)
    log.info("  %-22s  %4d", "skipped (parse-error)", skipped)
    log.info("  %-22s  %4d", "WRITTEN" if not args.dry_run else "DRY-RUN (would write)", written)
    log.info("")
    if not args.dry_run:
        log.info("Next: review per-translator + per-reciter manually, then run")
        log.info("      `tsx scripts/data/ingest-qul-from-scrape.ts` to bulk-ingest.")


if __name__ == "__main__":
    main()
