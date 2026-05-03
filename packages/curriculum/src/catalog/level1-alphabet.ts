/**
 * Level 1 seed — 28 Arabic letters in mushaf order + 4 vowel-mark lessons.
 * v0.5 expands with letter-joining, basic-word-formation, and per-letter audio
 * exemplars from QUL.
 */
import type { Lesson } from '../types.js';

const ARABIC_LETTERS: ReadonlyArray<readonly [string, string, string]> = [
  ['alif', 'Alif', 'ا'],
  ['baa', "Bā'", 'ب'],
  ['taa', "Tā'", 'ت'],
  ['thaa', "Thā'", 'ث'],
  ['jeem', 'Jīm', 'ج'],
  ['haa-mahmala', "Ḥā'", 'ح'],
  ['khaa', "Khā'", 'خ'],
  ['daal', 'Dāl', 'د'],
  ['dhaal', 'Dhāl', 'ذ'],
  ['raa', "Rā'", 'ر'],
  ['zay', 'Zāy', 'ز'],
  ['seen', 'Sīn', 'س'],
  ['sheen', 'Shīn', 'ش'],
  ['saad', 'Ṣād', 'ص'],
  ['daad', 'Ḍād', 'ض'],
  ['taa-mufakhama', 'Ṭā', 'ط'],
  ['dhaa-mufakhama', 'Ẓā', 'ظ'],
  ['ayn', 'ʿAyn', 'ع'],
  ['ghayn', 'Ghayn', 'غ'],
  ['faa', "Fā'", 'ف'],
  ['qaaf', 'Qāf', 'ق'],
  ['kaaf', 'Kāf', 'ك'],
  ['laam', 'Lām', 'ل'],
  ['meem', 'Mīm', 'م'],
  ['noon', 'Nūn', 'ن'],
  ['haa-mantuqa', "Hā'", 'ه'],
  ['waaw', 'Wāw', 'و'],
  ['yaa', "Yā'", 'ي'],
];

const VOWEL_MARKS: ReadonlyArray<readonly [string, string, string]> = [
  ['fatha', 'Fatḥah (a)', 'َ'],
  ['kasra', 'Kasrah (i)', 'ِ'],
  ['damma', 'Ḍammah (u)', 'ُ'],
  ['sukun', 'Sukūn (no vowel)', 'ْ'],
];

function letterLesson(slug: string, name: string, glyph: string, order: number): Lesson {
  return {
    id: `l1-letter-${slug}`,
    slug: `letter-${slug}`,
    level: 1,
    order,
    title: { en: `Letter: ${name}`, ar: glyph },
    kind: 'letter-introduction',
    estimatedMinutes: 4,
    prerequisiteLessonIds: order === 1 ? [] : [`l1-letter-${ARABIC_LETTERS[order - 2]?.[0] ?? ''}`],
  };
}

function vowelLesson(slug: string, name: string, glyph: string, order: number): Lesson {
  return {
    id: `l1-vowel-${slug}`,
    slug: `vowel-${slug}`,
    level: 1,
    order,
    title: { en: name, ar: glyph },
    kind: 'vowel-mark',
    estimatedMinutes: 5,
    prerequisiteLessonIds: ['l1-letter-yaa'], // vowels come after the alphabet
  };
}

export const LEVEL_1_LESSONS: readonly Lesson[] = [
  ...ARABIC_LETTERS.map(([slug, name, glyph], i) => letterLesson(slug, name, glyph, i + 1)),
  ...VOWEL_MARKS.map(([slug, name, glyph], i) =>
    vowelLesson(slug, name, glyph, ARABIC_LETTERS.length + i + 1),
  ),
];
