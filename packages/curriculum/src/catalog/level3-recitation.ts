/**
 * Level 3 — Connected Recitation (~30 lessons).
 *
 * Per strategy §9.1. Builds fluency through staged practice on increasingly
 * difficult passages, plus an introduction to the maqamat (the melodic
 * systems used by traditional reciters).
 *
 * Each surah-mastery lesson links a verseRange so the lesson UI can render
 * the page directly via `@qalaam/ui-quran/MushafPage`.
 */
import type { Lesson } from '../types.js';

interface Spec {
  readonly slug: string;
  readonly titleEn: string;
  readonly kind: Lesson['kind'];
  readonly verseRange?: { readonly startVerseKey: string; readonly endVerseKey: string };
  readonly minutes: number;
  readonly prereq: string;
}

const SPECS: readonly Spec[] = [
  { slug: 'fluency-warmups', titleEn: 'Fluency warmups: Surah Al-Fatiha at three speeds', kind: 'ayah-practice', verseRange: { startVerseKey: '1:1', endVerseKey: '1:7' }, minutes: 12, prereq: 'l2-waqf-practice' },
  { slug: 'fluency-breath-control', titleEn: 'Breath control: pause / continue practice', kind: 'concept', minutes: 10, prereq: 'l3-fluency-warmups' },
  // Last 10 surahs (Juz Amma) — short surah mastery for working fluency
  { slug: 'surah-an-nas', titleEn: 'Surah An-Nās — line-level mastery', kind: 'surah-mastery', verseRange: { startVerseKey: '114:1', endVerseKey: '114:6' }, minutes: 12, prereq: 'l3-fluency-breath-control' },
  { slug: 'surah-al-falaq', titleEn: 'Surah Al-Falaq — line-level mastery', kind: 'surah-mastery', verseRange: { startVerseKey: '113:1', endVerseKey: '113:5' }, minutes: 12, prereq: 'l3-surah-an-nas' },
  { slug: 'surah-al-ikhlas', titleEn: 'Surah Al-Ikhlāṣ — line-level mastery', kind: 'surah-mastery', verseRange: { startVerseKey: '112:1', endVerseKey: '112:4' }, minutes: 10, prereq: 'l3-surah-al-falaq' },
  { slug: 'surah-al-masad', titleEn: 'Surah Al-Masad — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '111:1', endVerseKey: '111:5' }, minutes: 12, prereq: 'l3-surah-al-ikhlas' },
  { slug: 'surah-an-nasr', titleEn: 'Surah An-Naṣr — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '110:1', endVerseKey: '110:3' }, minutes: 10, prereq: 'l3-surah-al-masad' },
  { slug: 'surah-al-kafirun', titleEn: 'Surah Al-Kāfirūn — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '109:1', endVerseKey: '109:6' }, minutes: 12, prereq: 'l3-surah-an-nasr' },
  { slug: 'surah-al-kawthar', titleEn: 'Surah Al-Kawthar — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '108:1', endVerseKey: '108:3' }, minutes: 10, prereq: 'l3-surah-al-kafirun' },
  { slug: 'surah-al-maun', titleEn: 'Surah Al-Māʿūn — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '107:1', endVerseKey: '107:7' }, minutes: 12, prereq: 'l3-surah-al-kawthar' },
  { slug: 'surah-quraysh', titleEn: 'Surah Quraysh — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '106:1', endVerseKey: '106:4' }, minutes: 10, prereq: 'l3-surah-al-maun' },
  { slug: 'surah-al-fil', titleEn: 'Surah Al-Fīl — fluency drill', kind: 'surah-mastery', verseRange: { startVerseKey: '105:1', endVerseKey: '105:5' }, minutes: 12, prereq: 'l3-surah-quraysh' },
  // Mid-length intermediate surahs
  { slug: 'surah-al-mulk-1-10', titleEn: 'Surah Al-Mulk 1-10 — connected recitation', kind: 'ayah-practice', verseRange: { startVerseKey: '67:1', endVerseKey: '67:10' }, minutes: 18, prereq: 'l3-surah-al-fil' },
  { slug: 'surah-al-mulk-11-20', titleEn: 'Surah Al-Mulk 11-20 — connected recitation', kind: 'ayah-practice', verseRange: { startVerseKey: '67:11', endVerseKey: '67:20' }, minutes: 18, prereq: 'l3-surah-al-mulk-1-10' },
  { slug: 'surah-al-mulk-21-30', titleEn: 'Surah Al-Mulk 21-30 (full surah)', kind: 'surah-mastery', verseRange: { startVerseKey: '67:21', endVerseKey: '67:30' }, minutes: 20, prereq: 'l3-surah-al-mulk-11-20' },
  { slug: 'surah-yaseen-1-12', titleEn: 'Surah Yāsīn 1-12 — heart of the Quran', kind: 'ayah-practice', verseRange: { startVerseKey: '36:1', endVerseKey: '36:12' }, minutes: 22, prereq: 'l3-surah-al-mulk-21-30' },
  { slug: 'surah-yaseen-13-32', titleEn: 'Surah Yāsīn 13-32', kind: 'ayah-practice', verseRange: { startVerseKey: '36:13', endVerseKey: '36:32' }, minutes: 24, prereq: 'l3-surah-yaseen-1-12' },
  { slug: 'surah-yaseen-33-58', titleEn: 'Surah Yāsīn 33-58', kind: 'ayah-practice', verseRange: { startVerseKey: '36:33', endVerseKey: '36:58' }, minutes: 24, prereq: 'l3-surah-yaseen-13-32' },
  { slug: 'surah-yaseen-59-83', titleEn: 'Surah Yāsīn 59-83 (full surah)', kind: 'surah-mastery', verseRange: { startVerseKey: '36:59', endVerseKey: '36:83' }, minutes: 24, prereq: 'l3-surah-yaseen-33-58' },
  { slug: 'surah-ar-rahman-1-13', titleEn: 'Surah Ar-Raḥmān 1-13 — refrain pattern', kind: 'ayah-practice', verseRange: { startVerseKey: '55:1', endVerseKey: '55:13' }, minutes: 22, prereq: 'l3-surah-yaseen-59-83' },
  { slug: 'surah-ar-rahman-14-78', titleEn: 'Surah Ar-Raḥmān 14-78 (full surah)', kind: 'surah-mastery', verseRange: { startVerseKey: '55:14', endVerseKey: '55:78' }, minutes: 26, prereq: 'l3-surah-ar-rahman-1-13' },
  { slug: 'surah-al-kahf-1-10', titleEn: 'Surah Al-Kahf 1-10 (Friday recitation)', kind: 'ayah-practice', verseRange: { startVerseKey: '18:1', endVerseKey: '18:10' }, minutes: 24, prereq: 'l3-surah-ar-rahman-14-78' },
  { slug: 'surah-al-kahf-final-10', titleEn: 'Surah Al-Kahf — last 10 verses', kind: 'ayah-practice', verseRange: { startVerseKey: '18:101', endVerseKey: '18:110' }, minutes: 22, prereq: 'l3-surah-al-kahf-1-10' },
  // Waqf practice integration
  { slug: 'waqf-practice-on-mulk', titleEn: 'Waqf practice — applying stops to Surah Al-Mulk', kind: 'concept', minutes: 16, prereq: 'l3-surah-al-kahf-final-10' },
  { slug: 'waqf-practice-on-rahman', titleEn: 'Waqf practice — applying stops to Surah Ar-Raḥmān', kind: 'concept', minutes: 16, prereq: 'l3-waqf-practice-on-mulk' },
  // Maqamat introduction
  { slug: 'maqam-introduction', titleEn: 'Maqāmāt: an introduction to melodic systems', kind: 'concept', minutes: 14, prereq: 'l3-waqf-practice-on-rahman' },
  { slug: 'maqam-bayati', titleEn: 'Maqām Bayātī — listening practice', kind: 'concept', minutes: 12, prereq: 'l3-maqam-introduction' },
  { slug: 'maqam-rast', titleEn: 'Maqām Rast — listening practice', kind: 'concept', minutes: 12, prereq: 'l3-maqam-bayati' },
  { slug: 'maqam-hijaz', titleEn: 'Maqām Ḥijāz — listening practice', kind: 'concept', minutes: 12, prereq: 'l3-maqam-rast' },
  { slug: 'maqam-application', titleEn: 'Choosing your maqām: practical advice', kind: 'concept', minutes: 12, prereq: 'l3-maqam-hijaz' },
];

export const LEVEL_3_LESSONS: readonly Lesson[] = SPECS.map((s, i) => ({
  id: `l3-${s.slug}`,
  slug: s.slug,
  level: 3,
  order: i + 1,
  title: { en: s.titleEn },
  kind: s.kind,
  ...(s.verseRange !== undefined ? { verseRange: s.verseRange } : {}),
  estimatedMinutes: s.minutes,
  prerequisiteLessonIds: [s.prereq],
}));
