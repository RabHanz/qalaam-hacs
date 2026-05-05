#!/usr/bin/env python3
"""
Ingest QUL `mushaf-layout-12` (Madani 16-line) image overlays.

Source: `data/qul-source/raw/unpacked/mushaf-layout-12.sqlite/6/`
Each page ships:
  - `<page>.png`  → hand-rendered KFGQPC mushaf page image
  - `<page>.json` → per-word rectangle map keyed by "<surah>:<ayah>:<word>"
                    {x, y, w, h} in image coordinates

We:
  1. Persist the overlay rectangles into `qalaam_v1_qul_image_overlays`
     (layout_id, page, surah, ayah, word, x, y, w, h).
  2. Copy the PNGs to `apps/web/public/mushaf-images/madani-16/<page>.png`
     so the web app serves them as static assets.

Idempotent: re-runs DELETE the layout's rows + replace.
The PNG copy step skips files that already exist with matching size.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path("/home/onnyx/qalam")
SRC = ROOT / "data/qul-source/raw/unpacked/mushaf-layout-12.sqlite/6"
DB = ROOT / "data/qul.sqlite"
WEB_PUBLIC = ROOT / "apps/web/public/mushaf-images/madani-16"

# Stable identifier for this layout in the overlays table. The "12" comes
# from QUL's own mushaf-layout-12 resource id (Madani 16-line).
LAYOUT_ID = "madani_16_image_overlay_v12"


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS qalaam_v1_qul_image_overlays (
          layout_id TEXT NOT NULL,
          page      INTEGER NOT NULL,
          surah     INTEGER NOT NULL,
          ayah      INTEGER NOT NULL,
          word      INTEGER NOT NULL,
          x         INTEGER NOT NULL,
          y         INTEGER NOT NULL,
          w         INTEGER NOT NULL,
          h         INTEGER NOT NULL,
          PRIMARY KEY (layout_id, page, surah, ayah, word)
        );
        CREATE INDEX IF NOT EXISTS idx_image_overlays_page
          ON qalaam_v1_qul_image_overlays(layout_id, page);
        CREATE INDEX IF NOT EXISTS idx_image_overlays_verse
          ON qalaam_v1_qul_image_overlays(layout_id, surah, ayah);
        """
    )


def main() -> int:  # noqa: PLR0915 — straight-line ingest pipeline; no clean split.
    if not SRC.exists():
        print(f"ERR: {SRC} missing", file=sys.stderr)
        return 2
    if not DB.exists():
        print(f"ERR: {DB} missing", file=sys.stderr)
        return 2
    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    ensure_schema(conn)

    # 1) Wipe + reingest the overlay rectangles.
    conn.execute("DELETE FROM qalaam_v1_qul_image_overlays WHERE layout_id = ?", (LAYOUT_ID,))
    json_files = sorted(SRC.glob("*.json"), key=lambda p: int(p.stem))
    print(f"ingesting {len(json_files)} pages of overlays")
    rows_total = 0
    for jf in json_files:
        try:
            page = int(jf.stem)
        except ValueError:
            continue
        with jf.open() as f:
            data = json.load(f)
        rows: list[tuple[str, int, int, int, int, int, int, int, int]] = []
        for key, rect in data.items():
            try:
                s_str, a_str, w_str = key.split(":")
                surah = int(s_str)
                ayah = int(a_str)
                word = int(w_str)
            except (ValueError, AttributeError):
                continue
            x = int(rect.get("x", 0))
            y = int(rect.get("y", 0))
            ww = int(rect.get("w", 0))
            hh = int(rect.get("h", 0))
            if ww <= 0 or hh <= 0:
                continue
            rows.append((LAYOUT_ID, page, surah, ayah, word, x, y, ww, hh))
        if rows:
            conn.executemany(
                """INSERT OR REPLACE INTO qalaam_v1_qul_image_overlays
                   (layout_id, page, surah, ayah, word, x, y, w, h)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                rows,
            )
            rows_total += len(rows)
    conn.commit()
    print(f"  inserted {rows_total} rectangles for {len(json_files)} pages")

    # 2) Stage the PNGs to apps/web/public so Next can serve them as static
    #    assets at /mushaf-images/madani-16/<page>.png. Skip files that already
    #    exist with the same size (cheap idempotency).
    pngs = sorted(SRC.glob("*.png"), key=lambda p: int(p.stem))
    copied = 0
    skipped = 0
    for src in pngs:
        dst = WEB_PUBLIC / src.name
        if dst.exists() and dst.stat().st_size == src.stat().st_size:
            skipped += 1
            continue
        shutil.copyfile(src, dst)
        copied += 1
    print(f"PNGs: copied={copied} skipped={skipped}  → {WEB_PUBLIC}")

    print()
    print("=== Final state ===")
    by_layout = list(
        conn.execute(
            """SELECT layout_id, COUNT(DISTINCT page), COUNT(*)
               FROM qalaam_v1_qul_image_overlays GROUP BY layout_id"""
        )
    )
    for layout_id, pages, rects in by_layout:
        print(f"  {layout_id:35s} pages={pages}  rects={rects}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
