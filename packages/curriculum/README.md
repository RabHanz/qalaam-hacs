# `@qalaam/curriculum`

Progressive Quranic Arabic curriculum. Per strategy §9.

## Levels

1. **Alphabet & Pronunciation** (~30 lessons) — letters, harakat, joining, basic word formation.
2. **Tajweed Fundamentals** (~40 lessons) — makhraj, sifat, noon-sakinah rules, meem-sakinah rules, madd, qalqalah, lam shamsiyyah/qamariyyah, raa rules.
3. **Connected Recitation** (~30 lessons) — fluency, intermediate surahs, waqf/ibtidaa, maqamat introduction.
4. **Advanced Mastery** (Pro) — full surah memorization, qira'at, teaching/certification preparation.

## Design rules

- **No XP / no coins / no gems.** Sticker-chart streaks + completion badges only (per §9.4 + §21.14).
- **No public leaderboards.** Family-private only.
- **Streaks have grace days.** Never punish a missed day.
- **Locked progression.** Level 2 requires Level 1; Level 3 requires Level 2; Level 4 is Pro.

## Use

```ts
import { LESSONS, lessonsByLevel, lessonById } from '@qalaam/curriculum';

const level1 = lessonsByLevel(1);
const introAlif = lessonById('alif-isolated');
```
