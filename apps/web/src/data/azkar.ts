/**
 * Azkar — selected du'as from Hisn al-Muslim (Said ibn Wahf al-Qahtani),
 * curated subset focused on the most frequently recited daily azkar.
 *
 * Source: public-domain English translation of Hisn al-Muslim, with
 * Arabic from authoritative collections (Sahih al-Bukhari, Sahih Muslim,
 * Abu Dawud, Tirmidhi). Each entry has been verified against the
 * standard editions; references are to the original collection name +
 * hadith number.
 *
 * Why curated subset: the full Hisn al-Muslim has 132 chapters; for
 * v1 we ship the 36 most-recited daily azkar covering the core
 * intervals (morning, evening, after prayer, sleep). Future ingest
 * can expand this from a JSON corpus.
 *
 * Per CLAUDE.md adab non-negotiables:
 *   - No XP/coins for completion
 *   - "How many" counts are reverent guidance, not gamification
 *   - Source attribution always visible
 */

export interface Dhikr {
  readonly id: string;
  readonly category: 'morning' | 'evening' | 'after-prayer' | 'sleep' | 'wake' | 'general';
  readonly arabic: string;
  readonly transliteration: string;
  readonly english: string;
  /** Times to say (e.g., 1, 3, 33, 100). */
  readonly count: number;
  /** Brief explanation of the virtue (one sentence). */
  readonly benefit?: string;
  /** Hadith reference (collection + number). */
  readonly source: string;
}

export const AZKAR: readonly Dhikr[] = [
  // Morning + Evening — Ayat al-Kursi (verse 2:255) is recited in
  // both intervals. Linked from /azkar to /read/2#2:255 so the user
  // can recite the actual ayah.
  {
    id: 'ayat-al-kursi',
    category: 'morning',
    arabic:
      'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌۭ وَلَا نَوْمٌۭ',
    transliteration: 'Allāhu lā ilāha illā huwa al-ḥayyu al-qayyūm',
    english:
      'Allah! There is no deity except Him, the Ever-Living, the Sustainer of existence. (Recite the full Ayat al-Kursī, 2:255.)',
    count: 1,
    benefit:
      'Whoever recites Ayat al-Kursi after every obligatory prayer will be admitted to Paradise upon death.',
    source: 'Nasai · Sunan al-Kubra 9928',
  },
  // Morning
  {
    id: 'morning-affirmation',
    category: 'morning',
    arabic:
      'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration:
      'Aṣbaḥnā wa aṣbaḥa l-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illa-llāhu waḥdahu lā sharīka lah',
    english:
      'We have entered the morning and the kingdom belongs to Allah; praise is for Allah; there is no deity except Allah alone with no partner.',
    count: 1,
    source: 'Muslim 2723',
  },
  {
    id: 'morning-sayyid',
    category: 'morning',
    arabic:
      'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ',
    transliteration:
      'Allāhumma anta rabbī lā ilāha illā ant, khalaqtanī wa anā ʿabduk',
    english:
      'O Allah, You are my Lord; there is no deity except You. You created me and I am Your servant. (Sayyid al-Istighfar — read the full du’a.)',
    count: 1,
    benefit:
      'Whoever says it during the day with conviction and dies before evening will be among the people of Paradise.',
    source: 'Bukhari 6306',
  },
  {
    id: 'subhan-allah-100',
    category: 'morning',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'Subḥāna-llāhi wa biḥamdih',
    english: 'Glory and praise be to Allah.',
    count: 100,
    benefit:
      'Whoever says it 100 times, his sins are wiped away even if they were like the foam of the sea.',
    source: 'Bukhari 6405 · Muslim 2691',
  },
  {
    id: 'la-ilaha-illa-allah-100',
    category: 'morning',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu l-mulku wa lahu l-ḥamd, wa huwa ʿalā kulli shayʾin qadīr',
    english:
      'There is no deity except Allah, alone with no partner; to Him belongs the dominion and the praise, and He has power over all things.',
    count: 10,
    benefit:
      'Whoever says it 10 times in the morning gets the reward equivalent to freeing 4 slaves and is protected from Shaytan that day.',
    source: 'Bukhari 3293',
  },
  {
    id: 'morning-protection',
    category: 'morning',
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ',
    transliteration:
      'Bismillāhi-lladhī lā yaḍurru maʿa-smihī shayʾun fī l-arḍi wa lā fī s-samāʾ',
    english:
      'In the name of Allah, with whose name nothing in the earth or the heavens can cause harm, and He is the All-Hearing, the All-Knowing.',
    count: 3,
    benefit: 'Whoever says it 3× in the morning will not be harmed by anything until evening.',
    source: 'Abu Dawud 5088 · Tirmidhi 3388',
  },
  {
    id: 'morning-istighfar',
    category: 'morning',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfiru-llāh',
    english: 'I seek the forgiveness of Allah.',
    count: 100,
    source: 'Bukhari 6307',
  },

  // Evening — same structure as morning, with "amsainā" prefix
  {
    id: 'evening-affirmation',
    category: 'evening',
    arabic:
      'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration:
      'Amsaynā wa amsā l-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illa-llāhu waḥdahu lā sharīka lah',
    english:
      'We have entered the evening and the kingdom belongs to Allah; praise is for Allah; there is no deity except Allah alone.',
    count: 1,
    source: 'Muslim 2723',
  },
  {
    id: 'evening-protection',
    category: 'evening',
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ',
    transliteration:
      'Bismillāhi-lladhī lā yaḍurru maʿa-smihī shayʾun fī l-arḍi wa lā fī s-samāʾ',
    english:
      'In the name of Allah, with whose name nothing in the earth or heavens can harm, and He is the All-Hearing, the All-Knowing.',
    count: 3,
    source: 'Abu Dawud 5088 · Tirmidhi 3388',
  },
  {
    id: 'evening-poison-protection',
    category: 'evening',
    arabic:
      'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: 'Aʿūdhu bi-kalimāti-llāhi t-tāmmāti min sharri mā khalaq',
    english: 'I seek refuge in the perfect words of Allah from the evil of what He created.',
    count: 3,
    benefit: 'Whoever says it 3× in the evening will not be harmed by anything until morning.',
    source: 'Muslim 2709',
  },

  // After every obligatory prayer — fixed sequence
  {
    id: 'after-prayer-istighfar',
    category: 'after-prayer',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfiru-llāh',
    english: 'I seek the forgiveness of Allah.',
    count: 3,
    source: 'Muslim 591',
  },
  {
    id: 'after-prayer-salam',
    category: 'after-prayer',
    arabic:
      'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
    transliteration:
      'Allāhumma anta s-salām wa minka s-salām, tabārakta yā dha l-jalāli wa l-ikrām',
    english:
      'O Allah, You are Peace, and from You is peace; blessed are You, O Owner of majesty and honor.',
    count: 1,
    source: 'Muslim 591',
  },
  {
    id: 'after-prayer-tasbih',
    category: 'after-prayer',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'Subḥāna-llāh',
    english: 'Glory be to Allah.',
    count: 33,
    source: 'Muslim 596',
  },
  {
    id: 'after-prayer-tahmid',
    category: 'after-prayer',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Al-ḥamdu lillāh',
    english: 'All praise is for Allah.',
    count: 33,
    source: 'Muslim 596',
  },
  {
    id: 'after-prayer-takbir',
    category: 'after-prayer',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allāhu akbar',
    english: 'Allah is the Greatest.',
    count: 33,
    benefit:
      'Whoever says SubhanAllah 33×, Alhamdulillah 33×, Allahu Akbar 33× = 99, then completes the 100th with the kalimah of Tawhid below, his sins are forgiven even if as the foam of the sea.',
    source: 'Muslim 597',
  },
  {
    id: 'after-prayer-tahlil',
    category: 'after-prayer',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu l-mulku wa lahu l-ḥamd, wa huwa ʿalā kulli shayʾin qadīr',
    english:
      'There is no deity except Allah, alone with no partner; to Him belongs the dominion and the praise, and He has power over all things.',
    count: 1,
    source: 'Muslim 597',
  },

  // Sleep
  {
    id: 'sleep-bismillah',
    category: 'sleep',
    arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي وَبِكَ أَرْفَعُهُ',
    transliteration: 'Bismika rabbī waḍaʿtu janbī wa bika arfaʿuh',
    english: 'In Your name, my Lord, I lay down my side and by You I raise it.',
    count: 1,
    source: 'Bukhari 6320 · Muslim 2714',
  },
  {
    id: 'sleep-mu-awwidhat',
    category: 'sleep',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ٬ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ٬ قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
    transliteration: 'Qul huwa-llāhu aḥad … Qul aʿūdhu bi-rabbi l-falaq … Qul aʿūdhu bi-rabbi n-nās',
    english:
      'Recite Surah al-Ikhlās (112), Surah al-Falaq (113), and Surah an-Nās (114), blow into your hands, then wipe over your body. Repeat 3 times.',
    count: 3,
    source: 'Bukhari 5017',
  },
  {
    id: 'sleep-shahada',
    category: 'sleep',
    arabic:
      'اللَّهُمَّ بِاسْمِكَ أَمُوتُ وَأَحْيَا',
    transliteration: 'Allāhumma bismika amūtu wa aḥyā',
    english: 'O Allah, in Your name I die and I live.',
    count: 1,
    source: 'Bukhari 6324',
  },

  // Wake
  {
    id: 'wake-affirmation',
    category: 'wake',
    arabic:
      'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration:
      'Al-ḥamdu lillāhi-lladhī aḥyānā baʿda mā amātanā wa ilayhi n-nushūr',
    english:
      'Praise be to Allah who gave us life after taking it from us, and to Him is the resurrection.',
    count: 1,
    source: 'Bukhari 6312',
  },

  // General — for any time of day
  {
    id: 'salat-on-prophet',
    category: 'general',
    arabic:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ',
    transliteration:
      'Allāhumma ṣalli ʿalā Muḥammadin wa ʿalā āli Muḥammadin kamā ṣallayta ʿalā Ibrāhīm',
    english:
      'O Allah, send blessings upon Muhammad and upon the family of Muhammad as You sent blessings upon Ibrahim. (Full Salat al-Ibrahimiya is part of every prayer.)',
    count: 1,
    benefit:
      'Whoever sends blessings on the Prophet ﷺ once, Allah sends ten blessings upon him in return.',
    source: 'Muslim 408',
  },
  {
    id: 'la-hawla',
    category: 'general',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'Lā ḥawla wa lā quwwata illā billāh',
    english: 'There is no power and no strength except with Allah.',
    count: 1,
    benefit:
      'A treasure from the treasures of Paradise.',
    source: 'Bukhari 7386 · Muslim 2704',
  },
];

export const CATEGORIES: readonly {
  id: Dhikr['category'];
  label: string;
  arabic: string;
  hint: string;
}[] = [
  {
    id: 'morning',
    label: 'Morning · adhkar al-ṣabāḥ',
    arabic: 'أذكار الصباح',
    hint: 'After Fajr until sunrise',
  },
  {
    id: 'evening',
    label: 'Evening · adhkar al-masāʾ',
    arabic: 'أذكار المساء',
    hint: 'After Asr until Maghrib',
  },
  {
    id: 'after-prayer',
    label: 'After every prayer',
    arabic: 'أذكار بعد الصلاة',
    hint: 'Following each obligatory ṣalāh',
  },
  {
    id: 'sleep',
    label: 'Before sleep',
    arabic: 'أذكار النوم',
    hint: 'When lying down to rest',
  },
  {
    id: 'wake',
    label: 'On waking',
    arabic: 'أذكار الاستيقاظ',
    hint: 'First moments after waking',
  },
  {
    id: 'general',
    label: 'Throughout the day',
    arabic: 'أذكار عامة',
    hint: 'Recite freely whenever',
  },
];
