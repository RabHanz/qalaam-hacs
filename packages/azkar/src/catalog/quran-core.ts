/**
 * Quranic adhkar — recited as protection (ruqyah), morning, evening, before sleep.
 * No hadith grading needed — `grading: 'quran'`. Virtue-narration sources cited
 * separately in `source` so the user can see why each is recommended in this slot.
 */
import type { Zikr } from '../types.js';

export const QURAN_CORE: readonly Zikr[] = [
  {
    id: 'ayat-al-kursi',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Ayat al-Kursi', ar: 'آيَةُ الْكُرْسِيِّ' },
    arabic:
      'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ',
    translationEn:
      'Allah — there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    count: 1,
    source: 'Quran 2:255',
    grading: 'quran',
    gradingNotes: 'Virtues: Sahih Bukhari 2311 (recited at night protects until morning).',
    verseKey: '2:255',
  },
  {
    id: 'al-ikhlas',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah Al-Ikhlas', ar: 'سُورَةُ ٱلْإِخْلَاصِ' },
    arabic:
      'قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ',
    translationEn:
      'Say: He is Allah, [who is] One, Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent.',
    count: 3,
    source: 'Quran 112',
    grading: 'quran',
    gradingNotes: 'Sunan Abi Dawud 5082, Tirmidhi 3575 — sahih (Albani).',
    verseKey: '112:1',
  },
  {
    id: 'al-falaq',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah Al-Falaq', ar: 'سُورَةُ ٱلْفَلَقِ' },
    arabic:
      'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ مِن شَرِّ مَا خَلَقَ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    translationEn:
      'Say: I seek refuge in the Lord of daybreak — from the evil of what He has created, and from the evil of darkness when it settles, and from the evil of the blowers in knots, and from the evil of an envier when he envies.',
    count: 3,
    source: 'Quran 113',
    grading: 'quran',
    gradingNotes: 'Sunan Abi Dawud 5082, Tirmidhi 3575 — sahih (Albani).',
    verseKey: '113:1',
  },
  {
    id: 'an-nas',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah An-Nas', ar: 'سُورَةُ ٱلنَّاسِ' },
    arabic:
      'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ مَلِكِ ٱلنَّاسِ إِلَٰهِ ٱلنَّاسِ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
    translationEn:
      'Say: I seek refuge in the Lord of mankind, the Sovereign of mankind, the God of mankind, from the evil of the retreating whisperer, who whispers [evil] into the breasts of mankind, from among the jinn and mankind.',
    count: 3,
    source: 'Quran 114',
    grading: 'quran',
    gradingNotes: 'Sunan Abi Dawud 5082, Tirmidhi 3575 — sahih (Albani).',
    verseKey: '114:1',
  },
  {
    id: 'baqarah-last-two',
    categories: ['evening', 'sleep', 'ruqyah'],
    title: { en: 'Last two verses of Surah al-Baqarah', ar: 'آخِرُ آيَتَيْنِ مِنْ سُورَةِ الْبَقَرَةِ' },
    arabic:
      'ءَامَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَ ۚ كُلٌّ ءَامَنَ بِٱللَّهِ وَمَلَٰٓئِكَتِهِۦ وَكُتُبِهِۦ وَرُسُلِهِۦ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِۦ ۚ وَقَالُوا۟ سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ ٱلْمَصِيرُ ۝ لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ ۚ أَنتَ مَوْلَىٰنَا فَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَٰفِرِينَ',
    translationEn:
      'The Messenger has believed in what was revealed to him from his Lord, and so have the believers… (continues to "and grant us victory over the disbelieving people").',
    count: 1,
    source: 'Quran 2:285-286',
    grading: 'quran',
    gradingNotes: 'Sahih Bukhari 5009 — "whoever recites these two ayahs at night, they will suffice him."',
    verseKey: '2:285',
  },
];
