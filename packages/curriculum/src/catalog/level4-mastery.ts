/**
 * Level 4 — Advanced Mastery (Pro).
 *
 * Per strategy §9.1. Light track in v0.5; richer when reciter-licensing for
 * voice-cloning lands and we can ship per-qiraʾah audio reference.
 *
 * The qiraʾāt lessons are deliberately listening-and-comparison only. Qalaam
 * does NOT teach the technical fiqh of the variant readings — that requires a
 * human teacher with ijazah (and we say so explicitly).
 */
import type { Lesson } from '../types.js';

interface Spec {
  readonly slug: string;
  readonly titleEn: string;
  readonly kind: Lesson['kind'];
  readonly minutes: number;
  readonly prereq: string;
}

const SPECS: readonly Spec[] = [
  { slug: 'qiraat-overview', titleEn: 'Qirāʾāt: an introduction to the canonical readings', kind: 'concept', minutes: 14, prereq: 'l3-maqam-application' },
  { slug: 'qiraat-hafs', titleEn: 'Hafs ʿan ʿĀṣim — the most-recited reading', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-overview' },
  { slug: 'qiraat-warsh', titleEn: 'Warsh ʿan Nāfiʿ — listening comparison', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-hafs' },
  { slug: 'qiraat-qaloon', titleEn: 'Qālūn ʿan Nāfiʿ — listening comparison', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-warsh' },
  { slug: 'qiraat-duri', titleEn: 'Al-Dūrī ʿan Abī ʿAmr — listening comparison', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-qaloon' },
  { slug: 'qiraat-shu3ba', titleEn: 'Shuʿba ʿan ʿĀṣim — listening comparison', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-duri' },
  { slug: 'qiraat-khalaf', titleEn: 'Khalaf ʿan Ḥamza — listening comparison', kind: 'concept', minutes: 12, prereq: 'l4-qiraat-shu3ba' },
  { slug: 'mastery-hifdh-juz-amma', titleEn: 'Memorize Juz ʿAmma — Hifdh-engine integration', kind: 'surah-mastery', minutes: 30, prereq: 'l4-qiraat-khalaf' },
  { slug: 'mastery-hifdh-juz-tabarak', titleEn: 'Memorize Juz Tabārak — Hifdh-engine integration', kind: 'surah-mastery', minutes: 30, prereq: 'l4-mastery-hifdh-juz-amma' },
  { slug: 'mastery-hifdh-juz-qad-sami3', titleEn: 'Memorize Juz Qad Samiʿa — Hifdh-engine integration', kind: 'surah-mastery', minutes: 30, prereq: 'l4-mastery-hifdh-juz-tabarak' },
  { slug: 'mastery-ijazah-prep', titleEn: 'Ijazah preparation: what comes after the app', kind: 'concept', minutes: 18, prereq: 'l4-mastery-hifdh-juz-qad-sami3' },
];

export const LEVEL_4_LESSONS: readonly Lesson[] = SPECS.map((s, i) => ({
  id: `l4-${s.slug}`,
  slug: s.slug,
  level: 4,
  order: i + 1,
  title: { en: s.titleEn },
  kind: s.kind,
  estimatedMinutes: s.minutes,
  prerequisiteLessonIds: [s.prereq],
}));
