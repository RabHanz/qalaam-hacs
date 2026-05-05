#!/usr/bin/env python3
"""
Strip GSUB and GPOS tables from an Arabic OpenType font so Satori can
render it. Why: Satori's opentype.js dependency crashes on lookupType 5
substFormat 3 (chained-context substitution) which every quality
Arabic font uses for joining-form selection. The Quran source text
we render comes from QUL/QPC and is *already pre-shaped* (cmap maps
codepoints to their initial/medial/final/isolated form via Arabic
Presentation Forms-A/B), so removing GSUB does NOT break legibility
for already-shaped Uthmani text.

Usage:
    uvx --from fonttools python scripts/data/strip-arabic-font-gsub.py \
        apps/web/public/fonts/og/noto-naskh-regular.ttf \
        apps/web/public/fonts/og/noto-naskh-no-gsub.ttf

Run this once when adding a new Arabic font for OG cards.
"""

import sys

from fontTools.ttLib import TTFont

EXPECTED_ARGV_LEN = 3  # script + src + dst


def strip(src: str, dst: str) -> None:
    f = TTFont(src)
    for tag in ("GSUB", "GPOS"):
        if tag in f:
            del f[tag]
    f.save(dst)


if __name__ == "__main__":
    if len(sys.argv) != EXPECTED_ARGV_LEN:
        print(f"usage: {sys.argv[0]} <src.ttf> <dst.ttf>", file=sys.stderr)
        sys.exit(1)
    strip(sys.argv[1], sys.argv[2])
    print(f"stripped: {sys.argv[2]}")
