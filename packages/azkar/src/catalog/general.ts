/**
 * General-purpose adhkar — fillers for any time of day.
 */
import type { Zikr } from '../types.js';

export const GENERAL: readonly Zikr[] = [
  {
    id: 'g-allahumma-salli-ala-muhammad',
    categories: ['general'],
    title: { en: 'Send blessings on the Prophet ﷺ' },
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    translationEn:
      'O Allah, send Your blessings upon Muhammad and the family of Muhammad, as You sent Your blessings upon Ibrahim and the family of Ibrahim — truly You are praiseworthy and glorious.',
    count: 1,
    source: 'Sahih Bukhari 3370 — Salawat al-Ibrahimiyyah',
    grading: 'sahih',
  },
  {
    id: 'g-subhanallahi-wabihamdihi-subhanallahil-azim',
    categories: ['general'],
    title: { en: 'Two phrases beloved to the Most Merciful' },
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
    transliteration: 'SubhanAllahi wa bihamdihi, SubhanAllahil-azim',
    translationEn: 'Glory be to Allah and praise be to Him; glory be to Allah, the Mighty.',
    count: 1,
    source: 'Sahih Bukhari 6406, Sahih Muslim 2694',
    grading: 'sahih',
    gradingNotes: 'Two phrases light on the tongue, heavy on the scale, beloved to the Most Merciful.',
  },
  {
    id: 'g-best-of-istighfar-shorter',
    categories: ['general'],
    title: { en: 'Astaghfirullah-alladhi-la-ilaha-illa-huwa' },
    arabic: 'أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ',
    translationEn:
      'I seek the forgiveness of Allah, besides whom there is no god, the Ever-Living, the Sustainer of all, and I turn to Him in repentance.',
    count: 1,
    source: 'Sunan Abi Dawud 1517, Tirmidhi 3577',
    grading: 'sahih',
    gradingNotes: 'Whoever says it is forgiven even if he had fled from battle.',
  },
  {
    id: 'g-allahumma-inni-asaluka-al-jannah',
    categories: ['general'],
    title: { en: 'O Allah, I ask You for Paradise and refuge from the Fire' },
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ، وَأَعُوذُ بِكَ مِنَ النَّارِ',
    translationEn: 'O Allah, I ask You for Paradise and seek refuge in You from the Fire.',
    count: 3,
    source: 'Sunan Abi Dawud 792',
    grading: 'sahih',
  },
  {
    id: 'g-allahumma-aslih-li-deeni',
    categories: ['general'],
    title: { en: 'O Allah, set right my religion, my world, my hereafter' },
    arabic:
      'اللَّهُمَّ أَصْلِحْ لِي دِينِي الَّذِي هُوَ عِصْمَةُ أَمْرِي، وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي، وَأَصْلِحْ لِي آخِرَتِي الَّتِي فِيهَا مَعَادِي، وَاجْعَلِ الْحَيَاةَ زِيَادَةً لِي فِي كُلِّ خَيْرٍ، وَاجْعَلِ الْمَوْتَ رَاحَةً لِي مِنْ كُلِّ شَرٍّ',
    translationEn:
      'O Allah, set right for me my religion which is the safeguard of my affairs; set right for me my world wherein is my livelihood; set right for me my hereafter to which is my return; make life an increase for me in every good, and make death a rest for me from every evil.',
    count: 1,
    source: 'Sahih Muslim 2720',
    grading: 'sahih',
  },
];
