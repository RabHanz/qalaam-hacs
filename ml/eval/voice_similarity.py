"""Voice-similarity evaluation harness for the Qalaam-house TTS.

Per strategy §26.5: success criterion at v2.0 is >=4/5 native-speaker blind
test on the Qalaam-house voice. The objective metric we track day-to-day is
speaker-embedding cosine similarity between the generated voice and the
target reference reciter set on a held-out set.
"""

from __future__ import annotations

import argparse


def main() -> None:
    ap = argparse.ArgumentParser(description="Voice-similarity eval (skeleton).")
    ap.add_argument("--model", type=str, required=True)
    ap.add_argument("--reference-set", type=str, default="ml/checkpoints/data/everyayah_eval")
    ap.add_argument("--out", type=str, default="ml/checkpoints/eval/voice_similarity.json")
    args = ap.parse_args()

    print(f"[skeleton] would eval {args.model} cosine similarity vs {args.reference_set}")
    print(f"[skeleton] output -> {args.out}")
    print("[skeleton] target: cosine >=0.85 across the elite-reciter set.")


if __name__ == "__main__":
    main()
