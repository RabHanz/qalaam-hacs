# `@qalaam/ui-quran`

Quran-specific UI primitives. Built on `@qalaam/ui` design tokens.

## Components

- `<MushafPage>` — page-faithful render (Madani 15-line by default).
- `<AyahLine>` — single ayah with WBW interactivity, current-word highlight, tajweed coloring.
- `<WordToken>` — Arabic word + optional gloss + optional tajweed-color class.
- `<TajweedColorLegend>` — legend modal explaining the rule colors.
- `<BasmalaHeader>` — opening Basmala for surahs 2-114 (skipped on Surah 9).
- `renderAyahCardSvg(...)` — server-side SVG generator for sharing cards.

## Design

- Default to Tarteel-grade restraint (cream/teal/gold).
- Tajweed colors mapped from the strategy's neutral palette — NOT a copy of Dar al-Maarifah's "Tajweed Quran" palette (which is a copyrighted work; see strategy §11.4).
- Mistake-color vocabulary inherited verbatim from Tarteel (red/green/yellow/brown).
