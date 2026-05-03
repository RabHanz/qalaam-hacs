/**
 * Level 2 — Tajweed Fundamentals (~40 lessons).
 *
 * Per strategy §9.1. Lessons cover articulation (makhraj), letter qualities
 * (sifat), the rules of Noon Sakinah/Tanween, Meem Sakinah, the Madd
 * categories, Qalqalah, Lam Shamsiyyah/Qamariyyah, Ghunnah, Raa rules,
 * Tafkheem/Tarqeeq, and the Waqf marks.
 *
 * Pre-requisites flow forward from Level 1 (alphabet → vowels → tajweed).
 *
 * Tajweed terminology kept canonical — every `tajweedRule` value matches a
 * key in `quran-tajweed`'s 17-rule catalog so the UI can color-link a lesson
 * to the actual Mushaf annotations.
 */
import type { Lesson } from '../types.js';

interface Spec {
  readonly slug: string;
  readonly titleEn: string;
  readonly titleAr?: string;
  readonly tajweedRule?: string;
  readonly minutes: number;
  readonly prereq: string;
}

const SPECS: readonly Spec[] = [
  // — Makhraj (articulation points) — 5 lessons
  { slug: 'makhraj-overview', titleEn: 'Articulation points: an overview', titleAr: 'المخارج', minutes: 8, prereq: 'l1-vowel-sukun' },
  { slug: 'makhraj-throat', titleEn: 'Throat letters: ء، ه، ع، ح، غ، خ', titleAr: 'الحلق', minutes: 10, prereq: 'l2-makhraj-overview' },
  { slug: 'makhraj-tongue', titleEn: 'Tongue letters: a layered map', titleAr: 'اللسان', minutes: 12, prereq: 'l2-makhraj-throat' },
  { slug: 'makhraj-lips', titleEn: 'Lip letters: ف، ب، م، و', titleAr: 'الشفتان', minutes: 8, prereq: 'l2-makhraj-tongue' },
  { slug: 'makhraj-nasal', titleEn: 'Nasal cavity (al-khayshum) and ghunnah anchor', titleAr: 'الخيشوم', minutes: 8, prereq: 'l2-makhraj-lips' },
  // — Sifat (letter qualities) — 4
  { slug: 'sifat-overview', titleEn: 'Letter qualities: an overview', titleAr: 'الصفات', minutes: 8, prereq: 'l2-makhraj-nasal' },
  { slug: 'sifat-shiddah-rakhawah', titleEn: 'Strong vs soft letters (shiddah / rakhawah)', minutes: 8, prereq: 'l2-sifat-overview' },
  { slug: 'sifat-isti3la-istifal', titleEn: 'Heavy vs light letters (istiʿlāʾ / istifāl)', minutes: 10, prereq: 'l2-sifat-shiddah-rakhawah' },
  { slug: 'sifat-jahr-hams', titleEn: 'Voiced vs whispered letters (jahr / hams)', minutes: 8, prereq: 'l2-sifat-isti3la-istifal' },
  // — Noon Sakinah & Tanween — 5
  { slug: 'noon-izhar', titleEn: 'Izhar Halqi: clear pronunciation before throat letters', tajweedRule: 'izhar', minutes: 10, prereq: 'l2-sifat-jahr-hams' },
  { slug: 'noon-idgham-with-ghunnah', titleEn: 'Idghām with ghunnah: ي، ن، م، و', tajweedRule: 'idgham_with_ghunnah', minutes: 12, prereq: 'l2-noon-izhar' },
  { slug: 'noon-idgham-without-ghunnah', titleEn: 'Idghām without ghunnah: ل، ر', tajweedRule: 'idgham_without_ghunnah', minutes: 10, prereq: 'l2-noon-idgham-with-ghunnah' },
  { slug: 'noon-iqlab', titleEn: 'Iqlāb: noon → meem before bāʾ', tajweedRule: 'iqlab', minutes: 10, prereq: 'l2-noon-idgham-without-ghunnah' },
  { slug: 'noon-ikhfa', titleEn: 'Ikhfāʾ Ḥaqīqī: the 15 ikhfaʾ letters', tajweedRule: 'ikhfa', minutes: 14, prereq: 'l2-noon-iqlab' },
  // — Meem Sakinah — 3
  { slug: 'meem-ikhfa-shafawi', titleEn: 'Ikhfāʾ Shafawī: meem before bāʾ', tajweedRule: 'ikhfa_shafawi', minutes: 8, prereq: 'l2-noon-ikhfa' },
  { slug: 'meem-idgham-shafawi', titleEn: 'Idghām Shafawī: meem before meem', tajweedRule: 'idgham_shafawi', minutes: 8, prereq: 'l2-meem-ikhfa-shafawi' },
  { slug: 'meem-izhar-shafawi', titleEn: 'Iẓhār Shafawī: clear meem before any other letter', minutes: 8, prereq: 'l2-meem-idgham-shafawi' },
  // — Madd categories — 8
  { slug: 'madd-overview', titleEn: 'Madd: an overview of lengthening', titleAr: 'المد', minutes: 8, prereq: 'l2-meem-izhar-shafawi' },
  { slug: 'madd-asli', titleEn: 'Madd Aṣlī (natural, 2 beats)', tajweedRule: 'madda_normal', minutes: 8, prereq: 'l2-madd-overview' },
  { slug: 'madd-far3i', titleEn: 'Madd Farʿī (secondary): introduction', minutes: 8, prereq: 'l2-madd-asli' },
  { slug: 'madd-muttasil', titleEn: 'Madd Wājib Muttaṣil (4-5 beats)', tajweedRule: 'madda_obligatory', minutes: 10, prereq: 'l2-madd-far3i' },
  { slug: 'madd-munfasil', titleEn: 'Madd Jāʾiz Munfaṣil (4-5 beats)', tajweedRule: 'madda_permissible', minutes: 10, prereq: 'l2-madd-muttasil' },
  { slug: 'madd-arid', titleEn: 'Madd ʿĀriḍ li-s-sukūn (2/4/6 beats at stop)', minutes: 10, prereq: 'l2-madd-munfasil' },
  { slug: 'madd-lazim', titleEn: 'Madd Lāzim (6 beats)', tajweedRule: 'madda_necessary', minutes: 12, prereq: 'l2-madd-arid' },
  { slug: 'madd-leen', titleEn: 'Madd al-Līn (the soft madd)', minutes: 8, prereq: 'l2-madd-lazim' },
  // — Qalqalah — 3
  { slug: 'qalqalah-overview', titleEn: 'Qalqalah letters: ق، ط، ب، ج، د', tajweedRule: 'qalqalah', minutes: 8, prereq: 'l2-madd-leen' },
  { slug: 'qalqalah-sughra', titleEn: 'Qalqalah Ṣughrā (small)', tajweedRule: 'qalqalah', minutes: 6, prereq: 'l2-qalqalah-overview' },
  { slug: 'qalqalah-kubra', titleEn: 'Qalqalah Kubrā (large)', tajweedRule: 'qalqalah', minutes: 6, prereq: 'l2-qalqalah-sughra' },
  // — Lam Shamsiyyah / Qamariyyah — 2
  { slug: 'lam-shamsiyyah', titleEn: 'Al-Lām al-Shamsiyyah (assimilated)', tajweedRule: 'laam_shamsiyah', minutes: 8, prereq: 'l2-qalqalah-kubra' },
  { slug: 'lam-qamariyyah', titleEn: 'Al-Lām al-Qamariyyah (clear)', minutes: 6, prereq: 'l2-lam-shamsiyyah' },
  // — Ghunnah — 2
  { slug: 'ghunnah-asli', titleEn: 'Ghunnah Aṣliyyah on shaddah', minutes: 8, prereq: 'l2-lam-qamariyyah' },
  { slug: 'ghunnah-application', titleEn: 'Applying Ghunnah across the rules', minutes: 10, prereq: 'l2-ghunnah-asli' },
  // — Raa rules — 2
  { slug: 'raa-tafkheem', titleEn: 'Raa: when it is heavy (tafkheem)', minutes: 10, prereq: 'l2-ghunnah-application' },
  { slug: 'raa-tarqeeq', titleEn: 'Raa: when it is light (tarqeeq)', minutes: 10, prereq: 'l2-raa-tafkheem' },
  // — Tafkheem / Tarqeeq — 3
  { slug: 'tafkheem-letters', titleEn: 'The 7 heavy letters', minutes: 8, prereq: 'l2-raa-tarqeeq' },
  { slug: 'lam-allah', titleEn: 'The lām of the name Allāh: when heavy / light', minutes: 8, prereq: 'l2-tafkheem-letters' },
  { slug: 'lam-allah-application', titleEn: 'Applying lām al-Allāh across context', minutes: 8, prereq: 'l2-lam-allah' },
  // — Waqf — 3
  { slug: 'waqf-overview', titleEn: 'Stopping signs (waqf marks): an overview', minutes: 10, prereq: 'l2-lam-allah-application' },
  { slug: 'waqf-types', titleEn: 'Tām, kāfī, ḥasan, qabīḥ — the four classes', minutes: 12, prereq: 'l2-waqf-overview' },
  { slug: 'waqf-practice', titleEn: 'Stopping practice on Surah Al-Mulk', minutes: 14, prereq: 'l2-waqf-types' },
];

export const LEVEL_2_LESSONS: readonly Lesson[] = SPECS.map((s, i) => ({
  id: `l2-${s.slug}`,
  slug: s.slug,
  level: 2,
  order: i + 1,
  title: { en: s.titleEn, ...(s.titleAr !== undefined ? { ar: s.titleAr } : {}) },
  kind: 'tajweed-rule',
  ...(s.tajweedRule !== undefined ? { tajweedRule: s.tajweedRule } : {}),
  estimatedMinutes: s.minutes,
  prerequisiteLessonIds: [s.prereq],
}));
