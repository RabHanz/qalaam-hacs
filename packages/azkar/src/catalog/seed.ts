/**
 * Canonical seed of the most-used adhkar. Verified text; full Hisn al-Muslim
 * comes in v0.5.
 */
import type { Zikr } from '../types.js';

export const SEED_AZKAR: readonly Zikr[] = [
  {
    id: 'ayat-al-kursi',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Ayat al-Kursi', ar: 'آيَةُ الْكُرْسِيِّ' },
    arabic:
      'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ',
    translationEn:
      'Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    count: 1,
    source: 'Quran 2:255 — Sahih Muslim 810 for virtues',
    verseKey: '2:255',
  },
  {
    id: 'al-falaq',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah Al-Falaq', ar: 'سُورَةُ ٱلْفَلَقِ' },
    arabic:
      'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ مِن شَرِّ مَا خَلَقَ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    translationEn:
      'Say, "I seek refuge in the Lord of daybreak, from the evil of that which He created, and from the evil of darkness when it settles, and from the evil of the blowers in knots, and from the evil of an envier when he envies."',
    count: 3,
    source: 'Quran 113 — Abu Dawud 5082, Tirmidhi 3575',
  },
  {
    id: 'an-nas',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah An-Nas', ar: 'سُورَةُ ٱلنَّاسِ' },
    arabic:
      'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ مَلِكِ ٱلنَّاسِ إِلَٰهِ ٱلنَّاسِ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
    translationEn:
      'Say, "I seek refuge in the Lord of mankind, the Sovereign of mankind, the God of mankind, from the evil of the retreating whisperer who whispers [evil] into the breasts of mankind, from among the jinn and mankind."',
    count: 3,
    source: 'Quran 114 — Abu Dawud 5082, Tirmidhi 3575',
  },
  {
    id: 'al-ikhlas',
    categories: ['morning', 'evening', 'sleep', 'ruqyah'],
    title: { en: 'Surah Al-Ikhlas', ar: 'سُورَةُ ٱلْإِخْلَاصِ' },
    arabic:
      'قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ',
    translationEn:
      'Say, "He is Allah, [who is] One, Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent."',
    count: 3,
    source: 'Quran 112 — Abu Dawud 5082, Tirmidhi 3575',
  },
  {
    id: 'morning-asbahna-ala-fitratil-islam',
    categories: ['morning'],
    title: { en: 'We have entered the morning upon the fiṭrah of Islam' },
    arabic:
      'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا، وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    translationEn:
      'We have entered the morning upon the fiṭrah of Islam, the word of pure faith, the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim — upright, submitting, and not of those who associate partners with Allah.',
    count: 1,
    source: 'Ahmad 3:406',
  },
  {
    id: 'evening-amsayna-ala-fitratil-islam',
    categories: ['evening'],
    title: { en: 'We have entered the evening upon the fiṭrah of Islam' },
    arabic:
      'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا، وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    translationEn:
      'We have entered the evening upon the fiṭrah of Islam, the word of pure faith, the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim — upright, submitting, and not of those who associate partners with Allah.',
    count: 1,
    source: 'Ahmad 3:406',
  },
  {
    id: 'tasbih-100',
    categories: ['post-salah', 'general'],
    title: { en: 'SubhanAllah' },
    arabic: 'سُبْحَانَ ٱللَّهِ',
    transliteration: 'SubhanAllah',
    translationEn: 'Glory be to Allah.',
    count: 33,
    source: 'Sahih Muslim 596',
  },
  {
    id: 'tahmid-33',
    categories: ['post-salah', 'general'],
    title: { en: 'Alhamdulillah' },
    arabic: 'ٱلْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    translationEn: 'All praise is due to Allah.',
    count: 33,
    source: 'Sahih Muslim 596',
  },
  {
    id: 'takbir-34',
    categories: ['post-salah', 'general'],
    title: { en: 'Allahu Akbar' },
    arabic: 'ٱللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    translationEn: 'Allah is the Greatest.',
    count: 34,
    source: 'Sahih Muslim 596',
  },
  {
    id: 'sleep-bismika-allahumma',
    categories: ['sleep'],
    title: { en: 'In Your Name, O Allah, I die and live' },
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    translationEn: 'In Your Name, O Allah, I die and I live.',
    count: 1,
    source: 'Sahih al-Bukhari 6324',
  },
  {
    id: 'wake-alhamdulillahi-alladhi',
    categories: ['wake'],
    title: { en: 'Praise be to Allah who gave us life after death' },
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    translationEn:
      'All praise is due to Allah who gave us life after He had caused us to die, and to Him is the resurrection.',
    count: 1,
    source: 'Sahih al-Bukhari 6324',
  },
  {
    id: 'baqarah-last-two',
    categories: ['evening', 'sleep', 'ruqyah'],
    title: { en: 'Last two ayahs of Surah al-Baqarah' },
    arabic:
      'آمَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَ ۚ ... رَبَّنَا وَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَٰفِرِينَ',
    translationEn:
      'The Messenger has believed in what was revealed to him from his Lord, and so have the believers… (continues to "and grant us victory over the disbelieving people").',
    count: 1,
    source: 'Quran 2:285-286 — Sahih al-Bukhari 4008',
    verseKey: '2:285',
  },
];
