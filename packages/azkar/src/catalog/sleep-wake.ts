/**
 * Sleeping + waking adhkar — Hisn al-Muslim §28-29.
 */
import type { Zikr } from '../types.js';

export const SLEEP_WAKE: readonly Zikr[] = [
  {
    id: 's-bismika-allahumma-amutu',
    categories: ['sleep'],
    title: { en: 'In Your Name, O Allah, I die and live' },
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amutu wa ahya',
    translationEn: 'In Your Name, O Allah, I die and I live.',
    count: 1,
    source: 'Sahih Bukhari 6324',
    grading: 'sahih',
  },
  {
    id: 's-allahumma-aslamtu-nafsi',
    categories: ['sleep'],
    title: { en: 'O Allah, I have surrendered myself to You' },
    arabic:
      'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَنَبِيِّكَ الَّذِي أَرْسَلْتَ',
    translationEn:
      'O Allah, I have surrendered myself to You, entrusted my affair to You, turned my face to You, and committed my back to You — out of hope in You and fear of You. There is no refuge or escape from You except to You. I believe in Your Book which You revealed, and Your Prophet whom You sent.',
    count: 1,
    source: 'Sahih Bukhari 6311, Sahih Muslim 2710',
    grading: 'sahih',
    gradingNotes: 'Whoever says it before sleep and dies that night dies upon the fitrah.',
  },
  {
    id: 's-tasbih-tahmid-takbir-before-sleep',
    categories: ['sleep'],
    title: { en: 'SubhanAllah 33 / Alhamdulillah 33 / Allahu Akbar 34 before sleep' },
    arabic: 'سُبْحَانَ اللَّهِ ٣٣، الْحَمْدُ لِلَّهِ ٣٣، اللَّهُ أَكْبَرُ ٣٤',
    translationEn:
      'SubhanAllah ×33, Alhamdulillah ×33, Allahu Akbar ×34 — taught by the Prophet ﷺ to Fatimah and Ali ﷺ in place of household help.',
    count: 1,
    source: 'Sahih Bukhari 3705, Sahih Muslim 2727',
    grading: 'sahih',
  },
  {
    id: 's-the-3-quls-before-sleep',
    categories: ['sleep'],
    title: { en: 'Recite the 3 Quls and blow into the palms before sleep' },
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ — قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ — قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
    translationEn:
      'Recite Surahs Al-Ikhlas, Al-Falaq, Al-Nas — blow into the palms — wipe over the body, beginning with the head and face. Repeat 3 times.',
    count: 3,
    source: 'Sahih Bukhari 5017',
    grading: 'sahih',
    verseKey: '112:1',
  },
  {
    id: 'w-alhamdulillahi-alladhi-ahyana',
    categories: ['wake'],
    title: { en: 'Praise be to Allah who gave us life after death' },
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    translationEn:
      'All praise is due to Allah who gave us life after He had caused us to die, and to Him is the resurrection.',
    count: 1,
    source: 'Sahih Bukhari 6324',
    grading: 'sahih',
  },
  {
    id: 'w-la-ilaha-illa-allah-wahdahu-on-waking',
    categories: ['wake'],
    title: { en: 'On waking at night: La ilaha illa Allah …' },
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، الْحَمْدُ لِلَّهِ، وَسُبْحَانَ اللَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ. رَبِّ اغْفِرْ لِي',
    translationEn:
      'There is no god but Allah alone, no partner; His is the dominion, His is the praise, and He is over all things competent. Praise be to Allah, glory to Allah, there is no god but Allah, Allah is the Greatest. There is no power or might except by Allah. My Lord, forgive me.',
    count: 1,
    source: 'Sahih Bukhari 1154',
    grading: 'sahih',
    gradingNotes: 'Whoever says this on waking at night and supplicates — his supplication is answered. If he then prays, his prayer is accepted.',
  },
];
