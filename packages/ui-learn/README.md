# `@qalaam/ui-learn`

Curriculum UI primitives. Per strategy §9 + §11.

## Components

- `<LessonCard>` — thumbnail card with prereq lock state, duration estimate, completion check.
- `<LessonList>` — level header + scrollable list of cards with continuous progress.
- `<LessonView>` — single-lesson view with title, body, embedded mushaf snippet (if `verseRange`), audio CTA, completion button.
- `<LevelProgressBar>` — segment per lesson, completion-painted.
- `<MakhrajDiagram>` — SVG of articulation points (throat → tongue → lips → nasal cavity); used by Level 2 makhraj lessons.

## Design rules

- No XP / coins / gems (per strategy §9.4 + §21.14 — adab non-negotiable).
- Streaks live in `@qalaam/ui-hifdh`, never duplicated here.
- Pro lessons (Level 4) carry a small "Pro" pill but render the same as free.
- Prereq-locked lessons render dimmed with a lock glyph; the next-unlocked is highlighted.
