/**
 * Situational adhkar — Hisn al-Muslim §1-21 (entering home, eating, traveling, etc.).
 * Only sahih or hasan narrations.
 */
import type { Zikr } from '../types.js';

export const SITUATIONAL: readonly Zikr[] = [
  {
    id: 'sit-entering-home',
    categories: ['entering-home'],
    title: { en: 'On entering the home' },
    arabic:
      'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا',
    translationEn:
      'In the name of Allah we enter, in the name of Allah we leave, and upon Allah our Lord we rely.',
    count: 1,
    source: 'Sunan Abi Dawud 5096',
    grading: 'hasan',
    gradingNotes: 'Hasan per Ibn Hajar; greet the household with salam after.',
  },
  {
    id: 'sit-leaving-home',
    categories: ['leaving-home'],
    title: { en: 'On leaving the home' },
    arabic:
      'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    translationEn:
      'In the name of Allah, I place my trust in Allah, and there is no power or might except by Allah.',
    count: 1,
    source: 'Sunan Abi Dawud 5095, Tirmidhi 3426',
    grading: 'sahih',
    gradingNotes: 'Said: "You will be guarded, sufficed, and guided" — Shaytan moves away.',
  },
  {
    id: 'sit-before-eating',
    categories: ['before-eating'],
    title: { en: 'Before eating: Bismillah' },
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah',
    translationEn: 'In the name of Allah.',
    count: 1,
    source: 'Sunan Abi Dawud 3767, Tirmidhi 1858',
    grading: 'sahih',
    gradingNotes: 'If forgotten at start, say: "Bismillahi awwalahu wa akhirahu" mid-meal.',
  },
  {
    id: 'sit-after-eating',
    categories: ['after-eating'],
    title: { en: 'After eating: Alhamdulillah' },
    arabic:
      'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا، وَرَزَقَنِيهِ، مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    translationEn:
      'All praise is due to Allah who has fed me this and provided it for me, without any might or power on my part.',
    count: 1,
    source: 'Sunan Abi Dawud 4023, Tirmidhi 3458',
    grading: 'hasan',
    gradingNotes: 'Whoever says it — his past sins are forgiven.',
  },
  {
    id: 'sit-entering-bathroom',
    categories: ['entering-bathroom'],
    title: { en: 'On entering the bathroom' },
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    translationEn: 'O Allah, I seek refuge in You from male and female evil beings.',
    count: 1,
    source: 'Sahih Bukhari 142, Sahih Muslim 375',
    grading: 'sahih',
    gradingNotes: 'Said BEFORE entering, with the left foot in.',
  },
  {
    id: 'sit-leaving-bathroom',
    categories: ['leaving-bathroom'],
    title: { en: 'On leaving the bathroom' },
    arabic: 'غُفْرَانَكَ',
    transliteration: 'Ghufranak',
    translationEn: 'I seek Your forgiveness.',
    count: 1,
    source: 'Sunan Abi Dawud 30, Tirmidhi 7',
    grading: 'sahih',
  },
  {
    id: 'sit-after-wudu',
    categories: ['wudu'],
    title: { en: 'After completing wudu' },
    arabic:
      'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ. اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ، وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
    translationEn:
      'I bear witness that there is no god but Allah alone, no partner with Him; and I bear witness that Muhammad is His servant and messenger. O Allah, make me of those who turn to You in repentance, and of those who purify themselves.',
    count: 1,
    source: 'Sahih Muslim 234, Tirmidhi 55',
    grading: 'sahih',
    gradingNotes: 'The eight gates of Paradise are opened and he enters by whichever he wishes.',
  },
  {
    id: 'sit-travel',
    categories: ['travel', 'mounting-vehicle'],
    title: { en: 'On mounting the vehicle / starting travel' },
    arabic:
      'اللَّهُ أَكْبَرُ ٣، سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ. اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى. اللَّهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا، وَاطْوِ عَنَّا بُعْدَهُ. اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالْخَلِيفَةُ فِي الْأَهْلِ',
    translationEn:
      'Allahu Akbar ×3. Glory to Him who has subjected this to us, when we could never have it [by our efforts], and to our Lord we shall surely return. O Allah, we ask You in this journey of ours for righteousness and piety, and for actions that please You. O Allah, ease this journey for us and shorten its distance. O Allah, You are the Companion on the journey and the Successor over the family.',
    count: 1,
    source: 'Sahih Muslim 1342',
    grading: 'sahih',
    verseKey: '43:13',
  },
  {
    id: 'sit-distress-laa-ilaaha-illa-anta',
    categories: ['distress'],
    title: { en: 'In distress: Du\'a of Yunus ﷺ' },
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    translationEn: 'There is no god but You; glory to You — I have indeed been of the wrongdoers.',
    count: 1,
    source: 'Tirmidhi 3505 — sahih',
    grading: 'sahih',
    gradingNotes: 'No Muslim ever supplicates with this in any matter without Allah answering him.',
    verseKey: '21:87',
  },
  {
    id: 'sit-distress-allahumma-rahmataka-arju',
    categories: ['distress'],
    title: { en: 'In distress: O Allah, Your mercy I hope for' },
    arabic:
      'اللَّهُمَّ رَحْمَتَكَ أَرْجُو، فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ، وَأَصْلِحْ لِي شَأْنِي كُلَّهُ، لَا إِلَهَ إِلَّا أَنْتَ',
    translationEn:
      'O Allah, Your mercy I hope for — do not entrust me to myself for the blink of an eye; set right all of my affairs; there is no god but You.',
    count: 1,
    source: 'Sunan Abi Dawud 5090',
    grading: 'hasan',
  },
  {
    id: 'sit-rain',
    categories: ['rain'],
    title: { en: 'When it rains' },
    arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
    transliteration: 'Allahumma sayyiban nafi\'an',
    translationEn: 'O Allah, [send] a beneficial rain.',
    count: 1,
    source: 'Sahih Bukhari 1032',
    grading: 'sahih',
  },
  {
    id: 'sit-end-gathering',
    categories: ['gathering-end'],
    title: { en: 'Du\'a at the end of a gathering — atones for what was said in it' },
    arabic:
      'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
    translationEn:
      'Glory to You, O Allah, and praise be to You. I bear witness that there is no god but You; I seek Your forgiveness and turn to You in repentance.',
    count: 1,
    source: 'Tirmidhi 3433, Sunan Abi Dawud 4859',
    grading: 'sahih',
    gradingNotes: 'Atones for whatever was said in the gathering.',
  },
];
