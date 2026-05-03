"""Per-reciter WER eval harness for Quran ASR models.

Per strategy §24 (data flywheel): we track WER per reciter to identify which
reciters our model under-serves, then prioritize fine-tune data accordingly.
"""

from __future__ import annotations

import argparse


def main() -> None:
    ap = argparse.ArgumentParser(description="Per-reciter WER (skeleton).")
    ap.add_argument("--model", type=str, required=True, help="HF model id or local path")
    ap.add_argument(
        "--dataset",
        type=str,
        default="tarteel-ai/everyayah",
        help="Eval dataset (held-out split).",
    )
    ap.add_argument("--out", type=str, default="ml/checkpoints/eval/wer_per_reciter.json")
    args = ap.parse_args()

    print(f"[skeleton] would compute per-reciter WER for {args.model} on {args.dataset}")
    print(f"[skeleton] output → {args.out}")
    print("[skeleton] success criteria (per §26.5): mean WER ≤ 5% across the elite-reciter set.")


if __name__ == "__main__":
    main()
