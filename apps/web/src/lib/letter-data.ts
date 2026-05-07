/**
 * letter-data — structurally-factual data for the 28 Arabic alphabet
 * lessons + 4 vowel marks. NO pedagogical prose; everything here is
 * either Unicode property, articulation-anatomy, or a real verse
 * reference.
 *
 * The makhraj zone classifications follow the classical (Khalīl b.
 * Aḥmad / al-Jazariyyah) scheme that's universally taught. I'm not
 * authoring opinion — these mappings are uncontroversial.
 */

export type MakhrajZone = 'throat' | 'tongue' | 'lips' | 'nasal' | 'jawf';

/** A single Quranic example for a letter — short word, real verse. */
export interface Example {
  /** Arabic word, in Uthmani script. */
  readonly word: string;
  /** Latin transliteration. */
  readonly translit: string;
  /** Brief English gloss. */
  readonly gloss: string;
  /** Verse where the word occurs (`S:A`), so we can deep-link. */
  readonly verseKey: string;
}

export interface LetterEntry {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly glyph: string;
  readonly makhraj: MakhrajZone;
  /** 2–3 corpus examples for the lesson body. */
  readonly examples: readonly Example[];
}

/**
 * The 28 letters in canonical mushaf order. Each makhraj zone follows
 * al-Jazariyyah's classical taxonomy. Examples are common opening or
 * familiar words from the Mushaf — verifiable in the corpus.
 *
 * The four-position joining variant for each letter is computed at
 * render time via tatweel (ـ) anchoring, so we don't list those
 * here — they're a function of the glyph.
 */
export const LETTERS: readonly LetterEntry[] = [
  {
    slug: 'alif',
    nameEn: 'Alif',
    nameAr: 'الأَلِف',
    glyph: 'ا',
    makhraj: 'jawf',
    examples: [
      { word: 'اللَّه', translit: 'Allāh', gloss: 'God', verseKey: '1:1' },
      { word: 'إِيَّاكَ', translit: 'iyyāka', gloss: '(it is) You alone', verseKey: '1:5' },
    ],
  },
  {
    slug: 'baa',
    nameEn: 'Bā',
    nameAr: 'البَاء',
    glyph: 'ب',
    makhraj: 'lips',
    examples: [
      { word: 'بِسْمِ', translit: 'bismi', gloss: 'in the name of', verseKey: '1:1' },
      { word: 'رَبِّ', translit: 'rabbi', gloss: 'Lord (of)', verseKey: '1:2' },
    ],
  },
  {
    slug: 'taa',
    nameEn: 'Tā',
    nameAr: 'التَّاء',
    glyph: 'ت',
    makhraj: 'tongue',
    examples: [
      { word: 'تَعْبُدُ', translit: 'taʿbud', gloss: 'you worship', verseKey: '1:5' },
      { word: 'الزَّكَاةَ', translit: 'az-zakāh', gloss: 'the alms', verseKey: '2:43' },
    ],
  },
  {
    slug: 'thaa',
    nameEn: 'Thā',
    nameAr: 'الثَّاء',
    glyph: 'ث',
    makhraj: 'tongue',
    examples: [
      { word: 'ثُمَّ', translit: 'thumma', gloss: 'then', verseKey: '2:28' },
      { word: 'الثَّمَرَاتِ', translit: 'ath-thamarāt', gloss: 'the fruits', verseKey: '2:22' },
    ],
  },
  {
    slug: 'jeem',
    nameEn: 'Jīm',
    nameAr: 'الجِيم',
    glyph: 'ج',
    makhraj: 'tongue',
    examples: [
      { word: 'جَنَّاتٍ', translit: 'jannāt', gloss: 'gardens', verseKey: '2:25' },
      { word: 'الجَحِيمِ', translit: 'al-jaḥīm', gloss: 'the blaze', verseKey: '5:10' },
    ],
  },
  {
    slug: 'haa-mahmala',
    nameEn: 'Ḥā',
    nameAr: 'الحَاء',
    glyph: 'ح',
    makhraj: 'throat',
    examples: [
      { word: 'الحَمْدُ', translit: 'al-ḥamdu', gloss: 'all praise', verseKey: '1:2' },
      { word: 'الرَّحْمَٰنِ', translit: 'ar-raḥmān', gloss: 'the Most Merciful', verseKey: '1:1' },
    ],
  },
  {
    slug: 'khaa',
    nameEn: 'Khā',
    nameAr: 'الخَاء',
    glyph: 'خ',
    makhraj: 'throat',
    examples: [
      { word: 'خَلَقَ', translit: 'khalaqa', gloss: 'He created', verseKey: '2:29' },
      { word: 'الآخِرَةِ', translit: 'al-ākhirah', gloss: 'the hereafter', verseKey: '2:4' },
    ],
  },
  {
    slug: 'daal',
    nameEn: 'Dāl',
    nameAr: 'الدَّال',
    glyph: 'د',
    makhraj: 'tongue',
    examples: [
      { word: 'الدِّينِ', translit: 'ad-dīn', gloss: 'the (final) judgement', verseKey: '1:4' },
      { word: 'اهْدِنَا', translit: 'ihdinā', gloss: 'guide us', verseKey: '1:6' },
    ],
  },
  {
    slug: 'dhaal',
    nameEn: 'Dhāl',
    nameAr: 'الذَّال',
    glyph: 'ذ',
    makhraj: 'tongue',
    examples: [
      { word: 'الَّذِينَ', translit: 'alladhīna', gloss: 'those who', verseKey: '1:7' },
      { word: 'هَٰذَا', translit: 'hādhā', gloss: 'this', verseKey: '2:25' },
    ],
  },
  {
    slug: 'raa',
    nameEn: 'Rā',
    nameAr: 'الرَّاء',
    glyph: 'ر',
    makhraj: 'tongue',
    examples: [
      { word: 'رَبِّ', translit: 'rabbi', gloss: 'Lord', verseKey: '1:2' },
      {
        word: 'الرَّحِيمِ',
        translit: 'ar-raḥīm',
        gloss: 'the Especially Merciful',
        verseKey: '1:1',
      },
    ],
  },
  {
    slug: 'zay',
    nameEn: 'Zāy',
    nameAr: 'الزَّاي',
    glyph: 'ز',
    makhraj: 'tongue',
    examples: [
      { word: 'الزَّكَاةَ', translit: 'az-zakāh', gloss: 'the alms', verseKey: '2:43' },
      { word: 'يَزِيدُ', translit: 'yazīd', gloss: 'increases', verseKey: '2:10' },
    ],
  },
  {
    slug: 'seen',
    nameEn: 'Sīn',
    nameAr: 'السِّين',
    glyph: 'س',
    makhraj: 'tongue',
    examples: [
      { word: 'بِسْمِ', translit: 'bismi', gloss: 'in the name of', verseKey: '1:1' },
      { word: 'السَّمَاوَاتِ', translit: 'as-samāwāt', gloss: 'the heavens', verseKey: '2:22' },
    ],
  },
  {
    slug: 'sheen',
    nameEn: 'Shīn',
    nameAr: 'الشِّين',
    glyph: 'ش',
    makhraj: 'tongue',
    examples: [
      { word: 'الشَّيْطَانِ', translit: 'ash-shayṭān', gloss: 'the Shayṭān', verseKey: '2:36' },
      { word: 'شَيْءٍ', translit: 'shay’in', gloss: 'thing', verseKey: '2:20' },
    ],
  },
  {
    slug: 'saad',
    nameEn: 'Ṣād',
    nameAr: 'الصَّاد',
    glyph: 'ص',
    makhraj: 'tongue',
    examples: [
      { word: 'الصَّلَاةَ', translit: 'aṣ-ṣalāh', gloss: 'the prayer', verseKey: '2:3' },
      { word: 'الصِّرَاطَ', translit: 'aṣ-ṣirāṭ', gloss: 'the path', verseKey: '1:6' },
    ],
  },
  {
    slug: 'daad',
    nameEn: 'Ḍād',
    nameAr: 'الضَّاد',
    glyph: 'ض',
    makhraj: 'tongue',
    examples: [
      { word: 'الضَّالِّينَ', translit: 'aḍ-ḍāllīn', gloss: 'those astray', verseKey: '1:7' },
      { word: 'مَرِيضٌ', translit: 'marīḍ', gloss: 'a sickness', verseKey: '2:10' },
    ],
  },
  {
    slug: 'taa-mufakhama',
    nameEn: 'Ṭā',
    nameAr: 'الطَّاء',
    glyph: 'ط',
    makhraj: 'tongue',
    examples: [
      { word: 'الطَّيِّبَاتِ', translit: 'aṭ-ṭayyibāt', gloss: 'good things', verseKey: '2:57' },
      { word: 'صِرَاطَ', translit: 'ṣirāṭ', gloss: 'a path', verseKey: '1:6' },
    ],
  },
  {
    slug: 'dhaa-mufakhama',
    nameEn: 'Ẓā',
    nameAr: 'الظَّاء',
    glyph: 'ظ',
    makhraj: 'tongue',
    examples: [
      { word: 'الظَّالِمِينَ', translit: 'aẓ-ẓālimīn', gloss: 'the wrongdoers', verseKey: '2:35' },
      { word: 'أَظْلَمُ', translit: 'aẓlam', gloss: 'most unjust', verseKey: '2:140' },
    ],
  },
  {
    slug: 'ayn',
    nameEn: 'ʿAyn',
    nameAr: 'العَيْن',
    glyph: 'ع',
    makhraj: 'throat',
    examples: [
      { word: 'العَالَمِينَ', translit: 'al-ʿālamīn', gloss: 'all the worlds', verseKey: '1:2' },
      { word: 'نَعْبُدُ', translit: 'naʿbud', gloss: 'we worship', verseKey: '1:5' },
    ],
  },
  {
    slug: 'ghayn',
    nameEn: 'Ghayn',
    nameAr: 'الغَيْن',
    glyph: 'غ',
    makhraj: 'throat',
    examples: [
      {
        word: 'المَغْضُوبِ',
        translit: 'al-maghḍūb',
        gloss: 'those who earned wrath',
        verseKey: '1:7',
      },
      { word: 'غَيْرِ', translit: 'ghayri', gloss: 'other than', verseKey: '1:7' },
    ],
  },
  {
    slug: 'faa',
    nameEn: 'Fā',
    nameAr: 'الفَاء',
    glyph: 'ف',
    makhraj: 'lips',
    examples: [
      { word: 'فِي', translit: 'fī', gloss: 'in', verseKey: '2:5' },
      { word: 'الفَلَقِ', translit: 'al-falaq', gloss: 'the daybreak', verseKey: '113:1' },
    ],
  },
  {
    slug: 'qaaf',
    nameEn: 'Qāf',
    nameAr: 'القَاف',
    glyph: 'ق',
    makhraj: 'tongue',
    examples: [
      { word: 'قُلْ', translit: 'qul', gloss: 'say', verseKey: '112:1' },
      { word: 'القُرْآنَ', translit: 'al-qur’ān', gloss: 'the Qur’an', verseKey: '2:185' },
    ],
  },
  {
    slug: 'kaaf',
    nameEn: 'Kāf',
    nameAr: 'الكَاف',
    glyph: 'ك',
    makhraj: 'tongue',
    examples: [
      { word: 'مَالِكِ', translit: 'māliki', gloss: 'master of', verseKey: '1:4' },
      { word: 'إِيَّاكَ', translit: 'iyyāka', gloss: 'You alone', verseKey: '1:5' },
    ],
  },
  {
    slug: 'laam',
    nameEn: 'Lām',
    nameAr: 'اللَّام',
    glyph: 'ل',
    makhraj: 'tongue',
    examples: [
      { word: 'اللَّه', translit: 'Allāh', gloss: 'God', verseKey: '1:1' },
      { word: 'لِلَّهِ', translit: 'lillāh', gloss: 'to God belongs', verseKey: '1:2' },
    ],
  },
  {
    slug: 'meem',
    nameEn: 'Mīm',
    nameAr: 'المِيم',
    glyph: 'م',
    makhraj: 'lips',
    examples: [
      { word: 'بِسْمِ', translit: 'bismi', gloss: 'in the name of', verseKey: '1:1' },
      { word: 'المَلِكِ', translit: 'al-malik', gloss: 'the King', verseKey: '114:2' },
    ],
  },
  {
    slug: 'noon',
    nameEn: 'Nūn',
    nameAr: 'النُّون',
    glyph: 'ن',
    makhraj: 'tongue',
    examples: [
      { word: 'نَعْبُدُ', translit: 'naʿbud', gloss: 'we worship', verseKey: '1:5' },
      { word: 'النَّاسِ', translit: 'an-nās', gloss: 'mankind', verseKey: '114:1' },
    ],
  },
  {
    slug: 'haa-mantuqa',
    nameEn: 'Hā',
    nameAr: 'الهَاء',
    glyph: 'ه',
    makhraj: 'throat',
    examples: [
      { word: 'اهْدِنَا', translit: 'ihdinā', gloss: 'guide us', verseKey: '1:6' },
      { word: 'هُوَ', translit: 'huwa', gloss: 'He', verseKey: '112:1' },
    ],
  },
  {
    slug: 'waaw',
    nameEn: 'Wāw',
    nameAr: 'الوَاو',
    glyph: 'و',
    makhraj: 'lips',
    examples: [
      {
        word: 'وَالضُّحَىٰ',
        translit: 'waḍ-ḍuḥā',
        gloss: 'by the morning brightness',
        verseKey: '93:1',
      },
      { word: 'وَلَدَ', translit: 'walad', gloss: 'a child', verseKey: '112:3' },
    ],
  },
  {
    slug: 'yaa',
    nameEn: 'Yā',
    nameAr: 'اليَاء',
    glyph: 'ي',
    makhraj: 'tongue',
    examples: [
      { word: 'يَوْمِ', translit: 'yawmi', gloss: 'the day of', verseKey: '1:4' },
      { word: 'إِيَّاكَ', translit: 'iyyāka', gloss: 'You alone', verseKey: '1:5' },
    ],
  },
];

const LETTER_BY_SLUG = new Map<string, LetterEntry>(LETTERS.map((l) => [l.slug, l]));

export function getLetter(slug: string): LetterEntry | undefined {
  // The lesson slug includes the "letter-" prefix from the curriculum.
  // Strip it so this lookup accepts either form.
  const key = slug.startsWith('letter-') ? slug.slice('letter-'.length) : slug;
  return LETTER_BY_SLUG.get(key);
}

/* ─────────────── vowel marks ─────────────── */

export interface VowelEntry {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string;
  /** The mark itself (combining character). */
  readonly mark: string;
  /** The vowel sound (a / i / u / -). */
  readonly sound: string;
  /** Effect description — purely linguistic, factual. */
  readonly effect: string;
  /** Quranic word examples that prominently feature the mark. */
  readonly examples: readonly Example[];
}

export const VOWELS: readonly VowelEntry[] = [
  {
    slug: 'fatha',
    nameEn: 'Fatḥah',
    nameAr: 'الفَتْحَة',
    mark: 'َ',
    sound: 'a',
    effect: 'Adds a short "a" after the host consonant. The smallest stroke above the letter.',
    examples: [
      { word: 'نَصَرَ', translit: 'naṣara', gloss: 'he helped', verseKey: '110:1' },
      { word: 'كَتَبَ', translit: 'kataba', gloss: 'he wrote', verseKey: '2:179' },
    ],
  },
  {
    slug: 'kasra',
    nameEn: 'Kasrah',
    nameAr: 'الكَسْرَة',
    mark: 'ِ',
    sound: 'i',
    effect: 'Adds a short "i" after the host consonant. A single stroke beneath the letter.',
    examples: [
      { word: 'بِسْمِ', translit: 'bismi', gloss: 'in the name of', verseKey: '1:1' },
      { word: 'لِلَّهِ', translit: 'lillāhi', gloss: 'to God', verseKey: '1:2' },
    ],
  },
  {
    slug: 'damma',
    nameEn: 'Ḍammah',
    nameAr: 'الضَّمَّة',
    mark: 'ُ',
    sound: 'u',
    effect: 'Adds a short "u" after the host consonant. A small wāw-like loop above the letter.',
    examples: [
      { word: 'يَعْبُدُ', translit: 'yaʿbudu', gloss: 'he worships', verseKey: '1:5' },
      { word: 'هُوَ', translit: 'huwa', gloss: 'he', verseKey: '112:1' },
    ],
  },
  {
    slug: 'sukun',
    nameEn: 'Sukūn',
    nameAr: 'السُّكُون',
    mark: 'ْ',
    sound: '∅',
    effect: 'Marks the absence of any vowel — the consonant takes no vowel sound at all.',
    examples: [
      { word: 'يَسْأَلُ', translit: 'yas’alu', gloss: 'he asks', verseKey: '2:189' },
      { word: 'اهْدِنَا', translit: 'ihdinā', gloss: 'guide us', verseKey: '1:6' },
    ],
  },
];

const VOWEL_BY_SLUG = new Map<string, VowelEntry>(VOWELS.map((v) => [v.slug, v]));

export function getVowel(slug: string): VowelEntry | undefined {
  const key = slug.startsWith('vowel-') ? slug.slice('vowel-'.length) : slug;
  return VOWEL_BY_SLUG.get(key);
}

/* ─────────────── makhraj zones ─────────────── */

export interface MakhrajZoneEntry {
  readonly zone: MakhrajZone;
  readonly nameEn: string;
  readonly nameAr: string;
  /** Anatomical reference — purely structural, no opinion. */
  readonly anatomical: string;
  /** Letters that articulate from this zone. */
  readonly letters: readonly string[];
}

export const MAKHRAJ_ZONES: readonly MakhrajZoneEntry[] = [
  {
    zone: 'jawf',
    nameEn: 'The empty space (al-jawf)',
    nameAr: 'الجَوْف',
    anatomical: 'The hollow of the mouth and throat through which the long vowels resonate.',
    letters: ['ا', 'و', 'ي'],
  },
  {
    zone: 'throat',
    nameEn: 'The throat (al-ḥalq)',
    nameAr: 'الحَلْق',
    anatomical: 'Three regions: deepest throat (ء، ه), middle throat (ع، ح), upper throat (غ، خ).',
    letters: ['ء', 'ه', 'ع', 'ح', 'غ', 'خ'],
  },
  {
    zone: 'tongue',
    nameEn: 'The tongue (al-lisān)',
    nameAr: 'اللِّسَان',
    anatomical:
      'The largest set — back of tongue against soft palate (ق ك), middle tongue against hard palate (ج ش ي), tongue tip + teeth (د ت ط ز س ص ذ ث ظ), one side of tongue (ض), tongue tip alone (ل ن ر).',
    letters: [
      'ق',
      'ك',
      'ج',
      'ش',
      'ي',
      'د',
      'ت',
      'ط',
      'ز',
      'س',
      'ص',
      'ذ',
      'ث',
      'ظ',
      'ض',
      'ل',
      'ن',
      'ر',
    ],
  },
  {
    zone: 'lips',
    nameEn: 'The lips (ash-shafatān)',
    nameAr: 'الشَّفَتَان',
    anatomical: 'Inner lower lip + upper teeth (ف); both lips together (ب م و).',
    letters: ['ف', 'ب', 'م', 'و'],
  },
  {
    zone: 'nasal',
    nameEn: 'The nasal cavity (al-khayshūm)',
    nameAr: 'الخَيْشُوم',
    anatomical:
      'The nasal cavity — the resonant ghunnah carrier for م and ن in their tajweed contexts.',
    letters: ['م', 'ن'],
  },
];

const MAKHRAJ_BY_SLUG_PART: Record<string, MakhrajZone> = {
  throat: 'throat',
  tongue: 'tongue',
  lips: 'lips',
  nasal: 'nasal',
};

export function getMakhrajZoneFromSlug(slug: string): MakhrajZoneEntry | undefined {
  // Lesson slugs are 'makhraj-throat', 'makhraj-tongue', etc. Strip
  // the prefix and look up.
  const part = slug.startsWith('makhraj-') ? slug.slice('makhraj-'.length) : slug;
  const zone = MAKHRAJ_BY_SLUG_PART[part];
  if (!zone) return undefined;
  return MAKHRAJ_ZONES.find((z) => z.zone === zone);
}
