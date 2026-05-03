"""Fine-tune Whisper-large-v3 on the EveryAyah dataset.

Per ADR-0005 + strategy §20.5.1. Skeleton — actual training loop wired in v2.0
(per DEV_CHECKLIST.md Phase 14.1). This file documents the planned recipe so
intent is captured even before we run it.

Recipe (informed by ArabicNLP 2025 papers + community fine-tunes):
- Base: openai/whisper-large-v3 (NOT turbo per §20.5; turbo's 4-layer decoder
  hurts low-resource Arabic).
- Dataset: tarteel-ai/everyayah, all splits, 36 reciters.
- Optimizer: AdamW, lr=1e-5, weight_decay=0.01.
- Steps: ~50K, batch_size=16, gradient_accumulation=2.
- Eval every 2K steps on a held-out reciter set; track per-reciter WER.
- Hardware: 1× RTX 5090 (~12 hrs) or 1× H100 (~6 hrs).
- Output: qalaam/whisper-base-quran on Hugging Face (LFS-tracked weights).

Run:
    uv run python ml/training/finetune_whisper_quran.py --output qalaam/whisper-base-quran
"""

from __future__ import annotations

import argparse


def main() -> None:
    ap = argparse.ArgumentParser(description="Fine-tune Whisper on EveryAyah (skeleton).")
    ap.add_argument("--output", type=str, default="qalaam/whisper-base-quran")
    ap.add_argument("--base", type=str, default="openai/whisper-large-v3")
    ap.add_argument("--steps", type=int, default=50_000)
    ap.add_argument("--lr", type=float, default=1e-5)
    args = ap.parse_args()

    print(f"[skeleton] would fine-tune {args.base} → {args.output}")
    print(f"[skeleton] steps={args.steps}, lr={args.lr}")
    print(
        "[skeleton] real training wires in v2.0 per DEV_CHECKLIST.md Phase 14.1. "
        "See ml/README.md for the recipe."
    )


if __name__ == "__main__":
    main()
