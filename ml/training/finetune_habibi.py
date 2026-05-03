"""Fine-tune Habibi-TTS-MSA on the EveryAyah dataset.

Per ADR-0006 + strategy §20.5. Skeleton — actual training in v2.0 (DEV_CHECKLIST §14.2).

Recipe:
- Base: SWivid/Habibi-TTS (MSA model, Apache-2.0). NEVER F5-Emilia weights (CC-BY-NC).
- Dataset: tarteel-ai/everyayah, all reciters, 829 hours.
- Optimizer: AdamW, lr=1e-5.
- Steps: ~10K (Habibi already speaks Arabic well; we're nudging it toward
  Quranic prosody, not teaching it the language).
- Hardware: 1x RTX 5090 (~6 hrs) or 1x H100 (~3 hrs).
- Output: qalaam/habibi-quran on Hugging Face (LFS-tracked weights).
- Evaluation: voice-similarity vs target reciter on a held-out set (>0.85 cosine).

Run:
    uv run python ml/training/finetune_habibi.py --output qalaam/habibi-quran
"""

from __future__ import annotations

import argparse


def main() -> None:
    ap = argparse.ArgumentParser(description="Fine-tune Habibi-TTS-MSA on EveryAyah (skeleton).")
    ap.add_argument("--output", type=str, default="qalaam/habibi-quran")
    ap.add_argument("--base", type=str, default="SWivid/Habibi-TTS")
    ap.add_argument("--steps", type=int, default=10_000)
    ap.add_argument("--lr", type=float, default=1e-5)
    args = ap.parse_args()

    print(f"[skeleton] would fine-tune {args.base} (MSA branch) -> {args.output}")
    print(f"[skeleton] steps={args.steps}, lr={args.lr}")
    print(
        "[skeleton] real training wires in v2.0 per DEV_CHECKLIST.md Phase 14.2. "
        "Per ADR-0006: NEVER use F5-Emilia weights (CC-BY-NC); use Habibi MSA (Apache-2.0)."
    )


if __name__ == "__main__":
    main()
