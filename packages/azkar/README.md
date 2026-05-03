# `@qalaam/azkar`

Hisn al-Muslim (Fortress of the Muslim) catalog — categorized lookup over the canonical adhkar collection by Sa'eed bin Wahf al-Qahtani.

## Categories (v0.1)

- `morning` — adhkar al-sabaah
- `evening` — adhkar al-masaa
- `post-salah` — after-prayer adhkar
- `sleep` — adhkar before sleeping
- `wake` — adhkar on waking
- `ruqyah` — Falaq, Nas, Ikhlas, Ayat al-Kursi, last 2 of Baqarah

## Data sourcing

v0.1 ships a small **canonical seed** (the most-used 12 entries — Ayat al-Kursi, the three Quls, last verses of Baqarah, key morning/evening adhkar). v0.5 wires the full dataset from `hisnmuslim.com` JSON or `Yajeed/HisnElmoslem` (with hadith-grade verification per strategy §10.5).

The seed is sufficient to unblock the **smart-home scheduled morning/evening playback** feature (per §10.5 + §10.1).
