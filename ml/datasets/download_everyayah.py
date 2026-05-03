"""Download the tarteel-ai/everyayah dataset to local cache.

Per ADR-0005 + ADR-0006: EveryAyah is the canonical fine-tune corpus for both
ASR (Whisper-Quran) and TTS (Habibi-on-EveryAyah). 127K samples, 829 hours,
36 professional reciters.

Use:
    uv run python ml/datasets/download_everyayah.py --out ml/checkpoints/data/everyayah
"""

from __future__ import annotations

import argparse
from pathlib import Path

from datasets import load_dataset


def main() -> None:
    ap = argparse.ArgumentParser(description="Download tarteel-ai/everyayah")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("ml/checkpoints/data/everyayah"),
        help="Local cache path (must be on a fast disk; ~16 GB).",
    )
    ap.add_argument(
        "--reciters",
        type=str,
        default=None,
        help="Comma-separated reciter slugs to filter to (e.g., 'alafasy,husary')",
    )
    args = ap.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    print(f"→ Loading tarteel-ai/everyayah into {args.out}")
    ds = load_dataset("tarteel-ai/everyayah", cache_dir=str(args.out))

    if args.reciters:
        wanted = set(args.reciters.split(","))
        ds = {split: data.filter(lambda x: x["reciter"] in wanted) for split, data in ds.items()}

    for split, data in ds.items():
        print(f"  {split}: {len(data):,} samples")
    print("✓ Dataset cached. Next: run ml/training/finetune_whisper_quran.py")


if __name__ == "__main__":
    main()
