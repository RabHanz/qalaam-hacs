# `ml/` — training, datasets, evaluation

Per **ADR-0006** (TTS: Habibi-MSA self-host long-term) and **ADR-0005** (ASR: on-device Whisper-Quran).

## Layout

```
ml/
├── datasets/      # download + prep scripts (EveryAyah, AR-DAD, Quran-MD, RetaSy)
├── training/      # fine-tuning recipes (Whisper-Quran, Habibi-on-EveryAyah, mistake-detect)
├── eval/          # WER per reciter, similarity scores, mutashabihat-cluster precision
├── checkpoints/   # local cache; production checkpoints live on HF Hub
└── notebooks/     # exploratory; never the source of truth for shipped models
```

## Datasets to ship to v2.0 (per strategy §4.3 + §20.1)

| Dataset | Size | Use |
|---|---|---|
| `tarteel-ai/everyayah` | 127K samples, 829 hrs | TTS fine-tune (Habibi-on-EveryAyah), ASR baseline |
| `Quran-MD` (NeurIPS 2025) | 264K MP3, 32 reciters | NEW for 2026 — gold-standard alignment |
| `RetaSy/quranic_audio_dataset` | 7K | Mistake-labeled training |
| `AR-DAD` | 15,810 clips | Imitator robustness |

## Privacy guarantee for fine-tuned models

Per ADR-0005 + ADR-0007 + strategy §24.6: **No user audio is ever included in training datasets.** Only public, properly-licensed corpora. Any future fine-tune run that touches user data requires a separate ADR.

## Killer outputs

- `qalaam/whisper-base-quran` — Whisper-large-v3 fine-tuned on EveryAyah → published on HF (per ADR-0005). Beats `tarteel-ai/whisper-base-ar-quran` baseline by ~2% WER.
- `qalaam/habibi-quran` — Habibi-MSA fine-tuned on EveryAyah → published on HF (per ADR-0006). Powers the Qalaam-house voice.
- `qalaam/wav2vec2-quran-phoneme` — phoneme-level mistake detection per the ArabicNLP 2025 recipe (§20.5.1) — implements the "Adapting Whisper-large-v3 as Speech-to-Phoneme for Qur'anic" paper since no public weights exist.

These outputs ARE the data flywheel (per §24): user-side corrections feed re-training; better model → better Qalaam → more users → more corrections.
