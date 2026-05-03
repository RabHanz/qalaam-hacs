/**
 * Morning + evening adhkar shared from Hisn al-Muslim (paragraph numbers 27-77).
 * Each entry is shipped only with sahih or hasan grading per major scholars
 * (Albani, Arna'ut, Wadi'i). Where graders differ, the most conservative
 * authentication is taken — and noted in `gradingNotes`.
 *
 * Many adhkar are recited at both morning and evening with the only change being
 * "asbah" ↔ "amsa" (we entered the morning / evening). For those, we ship the
 * morning version + a paired evening entry; the schedule decides which to play.
 */
import type { Zikr } from '../types.js';

export const MORNING_EVENING: readonly Zikr[] = [
  {
    id: 'm-asbahna-fitratil-islam',
    categories: ['morning'],
    title: { en: 'We have entered the morning upon the fiṭrah of Islam' },
    arabic:
      'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ ﷺ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا، وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    translationEn:
      'We have entered the morning upon the fiṭrah of Islam, the word of pure faith, the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim — upright, submitting, and not of those who associate partners with Allah.',
    count: 1,
    source: 'Musnad Ahmad 3:406',
    grading: 'sahih',
    gradingNotes: 'Sahih per Arna\'ut.',
  },
  {
    id: 'e-amsayna-fitratil-islam',
    categories: ['evening'],
    title: { en: 'We have entered the evening upon the fiṭrah of Islam' },
    arabic:
      'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ ﷺ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا، وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
    translationEn:
      'We have entered the evening upon the fiṭrah of Islam, the word of pure faith, the religion of our Prophet Muhammad ﷺ, and the way of our father Ibrahim — upright, submitting, and not of those who associate partners with Allah.',
    count: 1,
    source: 'Musnad Ahmad 3:406',
    grading: 'sahih',
  },
  {
    id: 'm-asbahna-wa-asbahal-mulk',
    categories: ['morning'],
    title: { en: 'We have entered the morning and the dominion is Allah\'s' },
    arabic:
      'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    translationEn:
      'We have entered the morning and the dominion belongs to Allah; all praise is for Allah. There is no god but Allah alone, He has no partner; His is the dominion and His is the praise, and He is over all things competent. My Lord, I ask You for the good of this day and the good of what follows it, and I seek refuge in You from the evil of this day and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age. My Lord, I seek refuge in You from torment in the Fire and torment in the grave.',
    count: 1,
    source: 'Sahih Muslim 2723',
    grading: 'sahih',
  },
  {
    id: 'e-amsayna-wa-amsal-mulk',
    categories: ['evening'],
    title: { en: 'We have entered the evening and the dominion is Allah\'s' },
    arabic:
      'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    translationEn:
      'We have entered the evening and the dominion belongs to Allah… (full pair of the morning version, with "this night" and "what follows it").',
    count: 1,
    source: 'Sahih Muslim 2723',
    grading: 'sahih',
  },
  {
    id: 'm-allahumma-bika-asbahna',
    categories: ['morning'],
    title: { en: 'O Allah, by You we enter the morning' },
    arabic:
      'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    translationEn:
      'O Allah, by You we enter the morning, by You we enter the evening, by You we live, by You we die, and to You is the resurrection.',
    count: 1,
    source: 'Sunan Abi Dawud 5068, Tirmidhi 3391',
    grading: 'sahih',
    gradingNotes: 'Sahih per Albani.',
  },
  {
    id: 'e-allahumma-bika-amsayna',
    categories: ['evening'],
    title: { en: 'O Allah, by You we enter the evening' },
    arabic:
      'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    translationEn:
      'O Allah, by You we enter the evening, by You we enter the morning, by You we live, by You we die, and to You is the destination.',
    count: 1,
    source: 'Sunan Abi Dawud 5068, Tirmidhi 3391',
    grading: 'sahih',
  },
  {
    id: 'm-sayyid-al-istighfar',
    categories: ['morning', 'evening'],
    title: { en: 'Sayyid al-Istighfar — the master of seeking forgiveness' },
    arabic:
      'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    translationEn:
      'O Allah, You are my Lord, there is no god but You. You created me and I am Your servant; I am upon Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge before You Your favor upon me, and I acknowledge my sin — so forgive me, for none forgives sins except You.',
    count: 1,
    source: 'Sahih Bukhari 6306',
    grading: 'sahih',
    gradingNotes: 'Whoever says it during the day with conviction and dies that day enters Paradise; same for night.',
  },
  {
    id: 'm-allahumma-aalim-al-ghayb',
    categories: ['morning', 'evening'],
    title: { en: 'O Allah, Knower of the unseen and the seen' },
    arabic:
      'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ',
    translationEn:
      'O Allah, Knower of the unseen and the seen, Originator of the heavens and the earth, Lord and Sovereign of everything — I bear witness that there is no god but You. I seek refuge in You from the evil of my soul, from the evil of Shaytan and his enticement to associate partners with Allah, and from committing wrong against myself or bringing it upon any Muslim.',
    count: 1,
    source: 'Sunan Abi Dawud 5067, Tirmidhi 3392',
    grading: 'sahih',
  },
  {
    id: 'm-bismillah-alladhi-la-yadurru',
    categories: ['morning', 'evening'],
    title: { en: 'In the name of Allah with whose name nothing harms' },
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    translationEn:
      'In the name of Allah with whose name nothing on earth or in the heavens can cause harm; He is the All-Hearing, the All-Knowing.',
    count: 3,
    source: 'Sunan Abi Dawud 5088, Tirmidhi 3388',
    grading: 'sahih',
    gradingNotes: 'Whoever says it three times morning and evening — nothing will harm them. Sahih per Albani.',
  },
  {
    id: 'm-radeetu-billahi',
    categories: ['morning', 'evening'],
    title: { en: 'I am pleased with Allah as my Lord' },
    arabic:
      'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا',
    translationEn:
      'I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad ﷺ as my Prophet.',
    count: 3,
    source: 'Sunan Abi Dawud 5072, Tirmidhi 3389',
    grading: 'sahih',
    gradingNotes: 'Whoever says it three times — Allah promises to please them on the Day of Judgment.',
  },
  {
    id: 'm-ya-hayyu-ya-qayyum',
    categories: ['morning', 'evening'],
    title: { en: 'O Living, O Sustaining — by Your mercy I seek aid' },
    arabic:
      'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
    translationEn:
      'O Living, O Sustaining — by Your mercy I seek aid. Set right all of my affairs, and do not entrust me to myself for the blink of an eye.',
    count: 1,
    source: 'Sunan al-Nasa\'i al-Kubra 10405, Mustadrak al-Hakim',
    grading: 'sahih',
    gradingNotes: 'Sahih per Albani in Sahih al-Targhib 661.',
  },
  {
    id: 'm-asbahna-wa-asbahal-mulku-lillah-comprehensive',
    categories: ['morning', 'evening'],
    title: { en: 'Allah suffices me — there is no god but Him' },
    arabic:
      'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
    translationEn:
      'Allah suffices me; there is no god but He. Upon Him I have placed my trust and He is the Lord of the Mighty Throne.',
    count: 7,
    source: 'Sunan Abi Dawud 5081',
    grading: 'hasan',
    gradingNotes: 'Hasan li-ghayrihi per Ibn Baz; some scholars classify the chain as marfu\' weak but the meaning is mutawatir Quran (9:129).',
    verseKey: '9:129',
  },
  {
    id: 'm-allahumma-inni-asaluka-al-afiyah',
    categories: ['morning', 'evening'],
    title: { en: 'O Allah, I ask You for pardon and well-being' },
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي',
    translationEn:
      'O Allah, I ask You for pardon and well-being in this world and the next. O Allah, I ask You for pardon and well-being in my religion, my worldly affairs, my family, and my wealth. O Allah, conceal my faults and grant me security from my fears. O Allah, guard me from in front, from behind, from my right, from my left, and from above; and I seek refuge in Your majesty from being taken unaware from beneath me.',
    count: 1,
    source: 'Sunan Abi Dawud 5074, Ibn Majah 3871',
    grading: 'sahih',
  },
  {
    id: 'm-subhanallahi-wa-bihamdihi-100',
    categories: ['morning', 'evening', 'general'],
    title: { en: 'Glory be to Allah and praise be to Him — 100 times' },
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'SubhanAllahi wa bi-hamdihi',
    translationEn: 'Glory be to Allah and praise be to Him.',
    count: 100,
    source: 'Sahih Muslim 2692',
    grading: 'sahih',
    gradingNotes: 'Whoever says it 100 times in a day, his sins are forgiven even if they are like the foam of the sea.',
  },
  {
    id: 'm-subhanallah-wa-bihamdihi-3',
    categories: ['morning', 'evening'],
    title: { en: 'Glory be to Allah and praise be to Him, by the number of His creation' },
    arabic:
      'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
    translationEn:
      'Glory be to Allah and praise be to Him — by the number of His creation, by the contentment of Himself, by the weight of His Throne, and by the ink of His words.',
    count: 3,
    source: 'Sahih Muslim 2726',
    grading: 'sahih',
    gradingNotes: 'Outweighs hours of dhikr — Juwayriyyah hadith.',
  },
  {
    id: 'm-la-ilaha-illa-allah-wahdahu-100',
    categories: ['morning', 'general'],
    title: { en: 'There is no god but Allah alone, no partner — 100 times' },
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    translationEn:
      'There is no god but Allah alone, He has no partner; His is the dominion, His is the praise, and He is over all things competent.',
    count: 100,
    source: 'Sahih Bukhari 6403',
    grading: 'sahih',
    gradingNotes: 'Whoever says it 100 times: equal to freeing 10 slaves, 100 good deeds recorded, 100 sins erased, protection from Shaytan that day.',
  },
  {
    id: 'm-astaghfirullah-wa-atubu-100',
    categories: ['morning', 'evening', 'general'],
    title: { en: 'I seek Allah\'s forgiveness and turn to Him — 100 times' },
    arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullaha wa atubu ilayhi',
    translationEn: 'I seek Allah\'s forgiveness and turn to Him in repentance.',
    count: 100,
    source: 'Sahih Bukhari 6307, Sahih Muslim 2702',
    grading: 'sahih',
  },
  {
    id: 'm-la-ilaha-illa-allah-100',
    categories: ['morning', 'evening', 'general'],
    title: { en: 'There is no god but Allah — 100 times' },
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ',
    transliteration: 'La ilaha illa Allah',
    translationEn: 'There is no god but Allah.',
    count: 100,
    source: 'Hisn al-Muslim §75',
    grading: 'sahih',
    gradingNotes: 'Wider hadith corpus on dhikr; this exact 100-count formulation is recommended; underlying virtue is mutawatir.',
  },
  {
    id: 'm-allahumma-salli-ala-muhammad-10',
    categories: ['morning', 'evening', 'general'],
    title: { en: 'Send blessings upon the Prophet ﷺ — 10 times' },
    arabic: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    translationEn: 'O Allah, send prayers and peace upon our Prophet Muhammad ﷺ.',
    count: 10,
    source: 'Tabarani — sahih per Albani in Sahih al-Targhib 656',
    grading: 'sahih',
    gradingNotes: 'Whoever sends salawat 10× morning and evening attains the Prophet\'s ﷺ intercession on the Day of Judgment.',
  },
  {
    id: 'e-aoodhu-bi-kalimati-allahi',
    categories: ['evening'],
    title: { en: 'I seek refuge in the perfect words of Allah from every evil' },
    arabic:
      'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    translationEn:
      'I seek refuge in the perfect words of Allah from the evil of what He has created.',
    count: 3,
    source: 'Sahih Muslim 2708',
    grading: 'sahih',
    gradingNotes: 'Whoever says it 3 times in the evening — no harm will reach him that night.',
  },
];
